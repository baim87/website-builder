import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAdsClient } from './clients/google-ads.client';

@Injectable()
export class SecondaryKeywordWorker {
  private readonly logger = new Logger(SecondaryKeywordWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdsClient: GoogleAdsClient,
  ) {}

  /**
   * Background task to fetch keyword volumes for all secondary cities
   * in the project's service areas.
   */
  async enrichSecondaryKeywords(projectId: string) {
    try {
      this.logger.log(`[SecondaryKeywordWorker] Starting enrichment for project ${projectId}...`);
      
      const ctx = await this.prisma.businessContext.findUnique({
        where: { projectId },
        select: { serviceAreas: true, trade: true, location: true }
      });

      if (!ctx || !ctx.serviceAreas || !Array.isArray(ctx.serviceAreas)) {
        this.logger.warn(`[SecondaryKeywordWorker] No service areas found for project ${projectId}`);
        return;
      }

      // We only care about secondary cities, so we exclude the primary location
      const primaryCity = ctx.location ? ctx.location.split(',')[0].trim().toLowerCase() : '';
      const secondaryCities = ctx.serviceAreas
        .map(c => String(c).trim())
        .filter(c => c.toLowerCase() !== primaryCity);

      if (secondaryCities.length === 0) {
        this.logger.log(`[SecondaryKeywordWorker] No secondary cities to process for project ${projectId}`);
        return;
      }

      // Find the services the user selected
      const mainServices = await this.prisma.serviceKeywordMetrics.findMany({
        where: { projectId, city: ctx.location ? ctx.location.trim().toLowerCase() : '' },
        select: { service: true }
      });

      const services = mainServices.map(s => s.service);
      if (services.length === 0) {
        this.logger.warn(`[SecondaryKeywordWorker] No services found for project ${projectId}`);
        return;
      }

      this.logger.log(`[SecondaryKeywordWorker] Processing ${services.length} services across ${secondaryCities.length} secondary cities...`);

      for (const city of secondaryCities) {
        this.logger.log(`[SecondaryKeywordWorker] Processing city: ${city} ...`);
        
        // Wait 2 seconds between cities to respect Google Ads rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const apiResults = await this.googleAdsClient.fetchKeywordsBatch(services, city);
          const projectInserts = [];

          for (let i = 0; i < services.length; i++) {
            const service = services[i];
            const bestKeyword = this.pickBestTransactionalKeyword(service, apiResults);
            
            let kwToSave = `${service} ${city}`;
            let volumeToSave = 0;
            let cpcToSave = null;
            let competitionToSave = null;

            if (bestKeyword) {
              kwToSave = bestKeyword.keyword;
              volumeToSave = bestKeyword.searchVolume;
              cpcToSave = bestKeyword.cpc;
              competitionToSave = bestKeyword.competition;
            }

            projectInserts.push({
              projectId,
              city: city.toLowerCase(),
              service,
              keyword: kwToSave,
              searchVolume: volumeToSave,
              cpc: cpcToSave,
              competition: competitionToSave,
              rank: i + 1,
              geoScope: 'city',
            });
          }

          if (projectInserts.length > 0) {
            await this.prisma.serviceKeywordMetrics.createMany({
              data: projectInserts,
              skipDuplicates: true,
            });
            this.logger.log(`[SecondaryKeywordWorker] Saved ${projectInserts.length} keywords for ${city}`);
          }
        } catch (cityError: any) {
          this.logger.error(`[SecondaryKeywordWorker] Error processing city ${city}: ${cityError.message}`);
        }
      }

      this.logger.log(`[SecondaryKeywordWorker] Completed secondary keyword enrichment for project ${projectId}`);
    } catch (e: any) {
      this.logger.error(`[SecondaryKeywordWorker] Fatal error for project ${projectId}: ${e.message}`, e.stack);
    }
  }

  private pickBestTransactionalKeyword(service: string, apiResults: any[]): any {
    const serviceTokens = service.toLowerCase().split(' ').filter(t => t.length > 2);
    
    let relevantResults = apiResults.filter(r => {
      const kw = r.keyword.toLowerCase();
      return kw.includes(service.toLowerCase()) || serviceTokens.some(token => kw.includes(token));
    });

    if (relevantResults.length === 0) {
      return null;
    }

    relevantResults.sort((a, b) => b.searchVolume - a.searchVolume);
    return relevantResults[0];
  }
}
