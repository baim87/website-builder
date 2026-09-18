import { Injectable, Logger } from '@nestjs/common';
import { GoogleAdsClient } from '../keywords/clients/google-ads.client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationMetricsService {
  private readonly logger = new Logger(LocationMetricsService.name);
  constructor(
    private readonly googleAdsClient: GoogleAdsClient,
    private readonly prisma: PrismaService,
  ) {
  }

  async processProjectMetrics(projectId: string, cities: string[], services: string[]) {
    this.logger.log(`Starting background location metrics processing for project ${projectId}. Cities: ${cities.length}`);
    
    // 3. Fetch volumes for each city+service combo
    const metricsToSave = [];

    // TIER 2: Pre-fetch from Global Cache
    const globalCacheResults = await this.prisma.globalKeywordCache.findMany({
      where: {
        city: { in: cities.map(c => c.toLowerCase()) },
        service: { in: services }
      }
    });
    
    const globalCacheMap = new Map();
    for (const res of globalCacheResults) {
      globalCacheMap.set(`${res.service.toLowerCase()}|${res.city.toLowerCase()}`, res);
    }
    
    for (const city of cities) {
      for (const service of services) {
        try {
          const cacheKey = `${service.toLowerCase()}|${city.toLowerCase()}`;
          const cached = globalCacheMap.get(cacheKey);
          
          if (cached) {
            this.logger.debug(`[TIER 2 HIT] Found ${service} in ${city} in GlobalKeywordCache.`);
            metricsToSave.push({
              projectId,
              city,
              service,
              keyword: cached.keyword,
              searchVolume: cached.searchVolume,
              difficulty: cached.competition || 0,
              cpc: cached.cpc || 0,
            });
            continue;
          }

          // Add a delay to respect Google Ads strict quotas
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          this.logger.debug(`[TIER 3 MISS] Fetching keywords for ${service} in ${city}...`);
          const results = await this.googleAdsClient.fetchKeywords(service, city);
          
          if (results && results.length > 0) {
            // Strict Transactional Filter
            const serviceTokens = service.toLowerCase().split(' ').filter(t => t.length > 2);
            let relevantResults = results.filter(r => {
              const kw = r.keyword.toLowerCase();
              return kw.includes(service.toLowerCase()) || serviceTokens.some(token => kw.includes(token));
            });

            const infoWords = ['how', 'what', 'why', 'cost of', 'diy', 'price', 'vs', 'vs.', 'guide'];
            const brandWords = ['home depot', 'lowes', 'menards', 'buy', 'for sale'];
            const badWords = [...infoWords, ...brandWords];
            
            relevantResults = relevantResults.filter(r => {
              const kw = r.keyword.toLowerCase();
              return !badWords.some(bad => kw.includes(bad) || kw.startsWith(bad));
            });
            
            // Contractor Intent Boost
            const contractorIntent = ['contractor', 'contractors', 'company', 'companies', 'builder', 'builders', 'installer', 'installation', 'services', 'repair', 'near me', city.toLowerCase().split(',')[0]];
            
            // Score and sort
            relevantResults.sort((a, b) => {
              const aKw = a.keyword.toLowerCase();
              const bKw = b.keyword.toLowerCase();
              const aBoost = contractorIntent.some(i => aKw.includes(i)) ? 2 : 1;
              const bBoost = contractorIntent.some(i => bKw.includes(i)) ? 2 : 1;
              return (b.searchVolume * bBoost) - (a.searchVolume * aBoost);
            });

            if (relevantResults.length > 0) {
              const topResult = relevantResults[0];
              
              metricsToSave.push({
                projectId,
                city,
                service,
                keyword: topResult.keyword,
                searchVolume: topResult.searchVolume,
                difficulty: topResult.competition || 0,
                cpc: topResult.cpc || 0,
              });

              // Save to Global Cache for future projects
              await this.prisma.globalKeywordCache.create({
                data: {
                  city: city.toLowerCase(),
                  state: city.includes(',') ? city.split(',')[1].trim().toUpperCase() : null,
                  trade: 'Local Service',
                  service,
                  keyword: topResult.keyword,
                  searchVolume: topResult.searchVolume,
                  competition: topResult.competition,
                  cpc: topResult.cpc,
                  monthlyVolumes: (topResult.monthlySearchVolumes as any) || [],
                  geoScope: 'local'
                }
              }).catch(() => {}); // Ignore unique constraint collisions
            }
          }
        } catch (error: any) {
           this.logger.warn(`Failed to fetch keyword volume for ${service} in ${city}: ${error.message}`);
        }
      }
    }
    
    // 3. Save to DB
    if (metricsToSave.length > 0) {
      await this.saveMetrics(metricsToSave);
      this.logger.log(`Successfully saved ${metricsToSave.length} keyword metrics for project ${projectId}.`);
    }
  }

  private async saveMetrics(metrics: any[]) {
    for (const metric of metrics) {
      await this.prisma.locationKeywordMetrics.upsert({
        where: {
          projectId_city_service: {
            projectId: metric.projectId,
            city: metric.city,
            service: metric.service,
          }
        },
        update: {
          keyword: metric.keyword,
          searchVolume: metric.searchVolume,
          difficulty: metric.difficulty,
          cpc: metric.cpc,
        },
        create: {
          projectId: metric.projectId,
          city: metric.city,
          service: metric.service,
          keyword: metric.keyword,
          searchVolume: metric.searchVolume,
          difficulty: metric.difficulty,
          cpc: metric.cpc,
        }
      });
    }
  }
}
