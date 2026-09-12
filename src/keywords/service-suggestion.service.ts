import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAdsClient } from './clients/google-ads.client';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AIModel } from '../common/constants/ai-models.constant';

export interface ServiceSuggestion {
  service: string;
  keyword: string;
  searchVolume: number;
  competition?: string;
  cpc?: number;
  monthlyVolumes?: any[];
}

@Injectable()
export class ServiceSuggestionService {
  private readonly logger = new Logger(ServiceSuggestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdsClient: GoogleAdsClient,
    private readonly aiGateway: AIGatewayService,
  ) {}

  async getServiceSuggestions(projectId: string, trade: string, location: string): Promise<ServiceSuggestion[]> {
    const normalizedLocation = location.trim().toLowerCase();
    
    // Extract state if available (e.g., "Omaha, NE" -> "NE")
    let parsedState: string | null = null;
    const parts = location.split(',');
    if (parts.length > 1) {
      parsedState = parts[1].trim().toUpperCase();
      if (parsedState.length > 2) {
        parsedState = parsedState.substring(0, 2);
      }
    }
    
    this.logger.log(`Starting service suggestions for project ${projectId} (Trade: ${trade}, Location: ${normalizedLocation}, State: ${parsedState})`);

    // 1. AI generates service list
    const aiServices = await this.generateServiceList(trade, location);
    this.logger.log(`AI generated ${aiServices.length} service candidates: ${aiServices.join(', ')}`);

    // Tier 1: Project-level DB lookup
    const existingProjectMetrics = await this.prisma.serviceKeywordMetrics.findMany({
      where: {
        projectId,
        city: normalizedLocation,
        service: { in: aiServices },
      },
    });

    const existingServiceMap = new Map(existingProjectMetrics.map(m => [m.service.toLowerCase(), m]));
    const missingFromProject = aiServices.filter(s => !existingServiceMap.has(s.toLowerCase()));

    const suggestions: ServiceSuggestion[] = [];

    // Add Tier 1 hits to suggestions
    for (const service of aiServices) {
      const existing = existingServiceMap.get(service.toLowerCase());
      if (existing) {
        this.logger.log(`[TIER 1 HIT] Service "${service}" found in Project Cache.`);
        suggestions.push({
          service: existing.service,
          keyword: existing.keyword,
          searchVolume: existing.searchVolume,
          competition: existing.competition || undefined,
          cpc: existing.cpc || undefined,
          monthlyVolumes: (existing.monthlyVolumes as any[]) || [],
        });
      }
    }

    let stillMissingServices = [...missingFromProject];

    // Tier 2: Global DB lookup for remaining missing services
    if (stillMissingServices.length > 0) {
      const globalMetrics = await this.prisma.globalKeywordCache.findMany({
        where: {
          city: normalizedLocation,
          service: { in: stillMissingServices },
        },
      });

      const globalMap = new Map(globalMetrics.map(m => [m.service.toLowerCase(), m]));
      
      // Filter down still missing
      stillMissingServices = stillMissingServices.filter(s => !globalMap.has(s.toLowerCase()));

      for (const service of missingFromProject) {
        const globalHit = globalMap.get(service.toLowerCase());
        if (globalHit) {
          this.logger.log(`[TIER 2 HIT] Service "${service}" found in Global Cache.`);
          suggestions.push({
            service: globalHit.service,
            keyword: globalHit.keyword,
            searchVolume: globalHit.searchVolume,
            competition: globalHit.competition || undefined,
            cpc: globalHit.cpc || undefined,
            monthlyVolumes: (globalHit.monthlyVolumes as any[]) || [],
          });
        }
      }
    }

    // Tier 3: Google Ads API for still missing services (limit to 20 for safety)
    const apiTargets = stillMissingServices.slice(0, 20);
    const globalInserts = [];

    if (apiTargets.length > 0) {
      this.logger.log(`[TIER 3 MISS] Fetching keywords for ${apiTargets.length} services from Google Ads...`);
      const apiResults = await this.googleAdsClient.fetchKeywordsBatch(apiTargets, location);

      for (const service of apiTargets) {
        const bestKeyword = this.pickBestTransactionalKeyword(service, apiResults);
        
        if (bestKeyword) {
          suggestions.push({
            service,
            keyword: bestKeyword.keyword,
            searchVolume: bestKeyword.searchVolume,
            competition: bestKeyword.competition,
            cpc: bestKeyword.cpc,
            monthlyVolumes: bestKeyword.monthlySearchVolumes,
          });

          globalInserts.push({
            city: normalizedLocation,
            state: parsedState,
            trade,
            service,
            keyword: bestKeyword.keyword,
            searchVolume: bestKeyword.searchVolume,
            monthlyVolumes: (bestKeyword.monthlySearchVolumes as any) || [],
            competition: bestKeyword.competition,
            cpc: bestKeyword.cpc,
            geoScope: 'national_proxy',
          });
        } else {
          // Fallback: zero-result
          suggestions.push({
            service,
            keyword: `${service} ${location}`,
            searchVolume: 0,
          });

          globalInserts.push({
            city: normalizedLocation,
            state: parsedState,
            trade,
            service,
            keyword: `${service} ${location}`,
            searchVolume: 0,
            geoScope: 'national_proxy',
          });
        }
      }

      // Persist to Global Cache
      if (globalInserts.length > 0) {
        await this.prisma.globalKeywordCache.createMany({
          data: globalInserts,
          skipDuplicates: true,
        });
        this.logger.log(`Persisted ${globalInserts.length} new metrics to GlobalKeywordCache.`);
      }
    }

    // Sort by search volume descending BEFORE assigning rank for Project DB inserts
    suggestions.sort((a, b) => b.searchVolume - a.searchVolume);

    // Build Project DB inserts (for ALL services that were missing from project DB initially)
    const projectInserts = [];
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      if (missingFromProject.some(ms => ms.toLowerCase() === s.service.toLowerCase())) {
        projectInserts.push({
          projectId,
          city: normalizedLocation,
          service: s.service,
          keyword: s.keyword,
          searchVolume: s.searchVolume,
          monthlyVolumes: (s.monthlyVolumes as any) || [],
          competition: s.competition,
          cpc: s.cpc,
          rank: i + 1,
          geoScope: 'national_proxy',
        });
      }
    }

    // Persist to Project Cache
    if (projectInserts.length > 0) {
      await this.prisma.serviceKeywordMetrics.createMany({
        data: projectInserts,
        skipDuplicates: true,
      });
      this.logger.log(`Persisted ${projectInserts.length} metrics to ServiceKeywordMetrics.`);
    }

    return suggestions;
  }

  private async generateServiceList(trade: string, location: string): Promise<string[]> {
    const prompt = `
      You are an expert in local service trades for the United States.
      The user is a contractor in the "${trade}" trade, operating in "${location}".
      Generate a list of 8-10 highly specific, standard, and transactional services that this contractor likely offers.
      For example, if the trade is "Decking", return specific services like "Deck Building", "Deck Repair", "Pergola Installation", etc.
      Return ONLY a valid JSON array of strings. Do not output anything else.
    `;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You are a helpful assistant. Always output a clean JSON array of strings.',
        messages: [{ role: 'user', content: prompt }],
        schema: {
          type: 'array',
          items: { type: 'string' }
        },
        schemaName: 'ServiceList'
      });
      
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      
      let parsed = JSON.parse(raw);
      
      // Some LLMs (like Anthropic) wrap the root array in an object when a schema is provided
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const values = Object.values(parsed);
        const arrayVal = values.find(v => Array.isArray(v));
        if (arrayVal) {
          parsed = arrayVal;
        }
      }

      if (!Array.isArray(parsed)) {
        this.logger.error(`Raw AI Output was: ${response.text}`);
        throw new Error('Parsed output is not an array');
      }
      return parsed as string[];
    } catch (e: any) {
      this.logger.error(`AI Service generation failed: ${e.message}`);
      // Absolute worst-case fallback
      return [`${trade} Services`, `Residential ${trade}`, `Commercial ${trade}`];
    }
  }

  private pickBestTransactionalKeyword(service: string, apiResults: any[]): any {
    // Filter results that contain the service name (case insensitive)
    const serviceTokens = service.toLowerCase().split(' ').filter(t => t.length > 2);
    
    let relevantResults = apiResults.filter(r => {
      const kw = r.keyword.toLowerCase();
      // Match if keyword contains the service or major tokens of the service
      return kw.includes(service.toLowerCase()) || serviceTokens.some(token => kw.includes(token));
    });

    if (relevantResults.length === 0) {
      return null;
    }

    // Exclude informational keywords
    const infoWords = ['how', 'what', 'why', 'cost of', 'diy', 'price', 'vs', 'vs.', 'guide'];
    relevantResults = relevantResults.filter(r => {
      const kw = r.keyword.toLowerCase();
      return !infoWords.some(info => kw.includes(info) || kw.startsWith(info));
    });

    if (relevantResults.length === 0) {
      return null;
    }

    // Sort by search volume
    relevantResults.sort((a, b) => b.searchVolume - a.searchVolume);

    // Pick the highest volume one
    return relevantResults[0];
  }
}
