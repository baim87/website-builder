import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAdsClient } from './clients/google-ads.client';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { KeywordResult } from './interfaces/keyword-data.interface';
import { AIModel } from '../common/constants/ai-models.constant';

@Injectable()
export class ServiceRankingService {
  private readonly logger = new Logger(ServiceRankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdsClient: GoogleAdsClient,
    private readonly aiGateway: AIGatewayService,
  ) { }

  async rankServices(
    projectId: string,
    servicesList: string[],
    primaryCity: string,
    county?: string,
    state?: string,
  ): Promise<void> {
    this.logger.log(`Ranking services for Project ${projectId} in ${primaryCity}...`);

    // Clear existing rankings to avoid duplicates on re-runs
    await this.prisma.serviceKeywordMetrics.deleteMany({ where: { projectId } });

    const results: any[] = [];
    let usedGeoScope = 'city';

    // Helper to fetch for a specific location safely using sequential requests
    const fetchAllPairs = async (location: string): Promise<{ service: string, data: KeywordResult | null }[]> => {
      const fetched: { service: string, data: KeywordResult | null }[] = [];
      for (const service of servicesList) {
        try {
          const apiResults = await this.googleAdsClient.fetchKeywords(service, location);

          if (apiResults.length > 0) {
            // Sort by highest volume and take top 1
            apiResults.sort((a, b) => b.searchVolume - a.searchVolume);
            fetched.push({ service, data: apiResults[0] });
          } else {
            fetched.push({ service, data: null });
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch keywords for ${service} in ${location}: ${error}`);
          fetched.push({ service, data: null });
        }

        // Sleep 1 second between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return fetched;
    };

    // Step 1: City-Level Data
    let keywordsData = await fetchAllPairs(primaryCity);
    let totalVolume = keywordsData.reduce((sum, item) => sum + (item.data?.searchVolume || 0), 0);

    // Step 2: County-Level Data Fallback (if all city volumes are 0)
    if (totalVolume === 0 && county) {
      this.logger.log(`City volumes are 0. Falling back to County (${county})...`);
      usedGeoScope = 'county';
      keywordsData = await fetchAllPairs(county);
      totalVolume = keywordsData.reduce((sum, item) => sum + (item.data?.searchVolume || 0), 0);
    }

    // Step 3: AI Fallback (if all county volumes are 0 or API completely failed)
    if (totalVolume === 0) {
      this.logger.log(`County/City volumes are 0. Falling back to AI Semantic Inference...`);
      usedGeoScope = 'ai_inferred';

      const rankedServices = await this.aiInferRanking(servicesList, primaryCity, state);

      // Map AI rankings back to the expected structure
      rankedServices.forEach((service, index) => {
        results.push({
          projectId,
          city: primaryCity,
          service: service,
          keyword: `${service} near me`, // Default inferred keyword
          searchVolume: 1000 - (index * 100), // Fake descending volumes to preserve rank sorting
          monthlyVolumes: null,
          rank: index + 1,
          geoScope: usedGeoScope,
        });
      });
    } else {
      // Sort and build final payload from Google Ads data
      keywordsData.sort((a, b) => (b.data?.searchVolume || 0) - (a.data?.searchVolume || 0));

      keywordsData.forEach((item, index) => {
        results.push({
          projectId,
          city: primaryCity,
          service: item.service,
          keyword: item.data?.keyword || `${item.service} in ${primaryCity}`,
          searchVolume: item.data?.searchVolume || 0,
          monthlyVolumes: (item.data as any)?.monthlySearchVolumes || null,
          competition: item.data?.competition || null,
          cpc: item.data?.cpc || null,
          rank: index + 1,
          geoScope: usedGeoScope,
        });
      });
    }

    // Persist all metrics
    if (results.length > 0) {
      await this.prisma.serviceKeywordMetrics.createMany({
        data: results,
      });
      this.logger.log(`Persisted ${results.length} service keyword metrics.`);
    }
  }

  private async aiInferRanking(services: string[], city: string, state?: string): Promise<string[]> {
    const prompt = `
      You are an expert of United States SEO and local marketing analyst.
      Given the following list of contractor services, rank them from highest search demand to lowest search demand for the location: ${city}, ${state || ''}.
      Only return a valid JSON array of strings, exactly matching the input services, ordered from highest demand to lowest.
      
      Services:
      ${JSON.stringify(services)}
    `;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You are a helpful SEO assistant. Always output clean JSON.',
        messages: [{ role: 'user', content: prompt }],
        schema: {
          type: 'array',
          items: { type: 'string' }
        },
        schemaName: 'ServiceRanking'
      });

      return JSON.parse(response.text) as string[];
    } catch (e: any) {
      this.logger.error(`AI Fallback failed: ${e.message}`);
      // Return original order as absolute worst-case fallback
      return services;
    }
  }
}
