import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { KeywordsService } from '../../keywords/keywords.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordStrategySchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';
import { buildKeywordStrategyPrompt } from '../prompts/builders/keyword-strategy.prompt';
import { ServiceRankingService } from '../../keywords/service-ranking.service';

@Injectable()
export class KeywordStrategySkill implements Skill {
  readonly name = 'KeywordStrategy';
  private readonly logger = new Logger(KeywordStrategySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly keywordsService: KeywordsService,
    private readonly prisma: PrismaService,
    private readonly validator: OutputValidatorService,
    private readonly serviceRankingService: ServiceRankingService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, pages } = input.context;
    const projectId = input.projectId;
    
    if (!businessContext || !businessContext.trade || !businessContext.location || !projectId) {
      throw new Error('KeywordStrategySkill requires businessContext with trade and location, and projectId');
    }

    this.logger.log(`Fetching keywords for ${businessContext.trade} in ${businessContext.location}`);
    
    // 1. Fetch real keyword data from Google Ads (with Redis cache)
    const keywords = await this.keywordsService.getKeywords(
      businessContext.trade,
      businessContext.location
    );
    
    // 1. Read pre-ranked service keyword data
    let serviceKeywordMetrics = await this.prisma.serviceKeywordMetrics.findMany({
      where: { projectId },
      orderBy: { rank: 'asc' },
    });

    // 2. Robust fallback: If data doesn't exist yet (e.g. skill called in isolation), fetch it now
    if (serviceKeywordMetrics.length === 0) {
      this.logger.warn('No pre-ranked service metrics found in DB. Fetching now via ServiceRankingService...');
      const servicesList = businessContext.services || [];
      const serviceNames = servicesList.map((s: any) => typeof s === 'string' ? s : (s.name || s.title || 'Service'));
      
      await this.serviceRankingService.rankServices(
        projectId, 
        serviceNames, 
        businessContext.location,
        businessContext.county,
        businessContext.state
      );
      serviceKeywordMetrics = await this.prisma.serviceKeywordMetrics.findMany({
        where: { projectId },
        orderBy: { rank: 'asc' },
      });
    }

    // 3. Transform into the format the prompt expects
    const serviceKeywords = serviceKeywordMetrics.map(m => ({
      service: m.service,
      keywords: [{ keyword: m.keyword, searchVolume: m.searchVolume, source: 'google' as const }],
    }));
    
    // 1.5 Fetch Radius Location Keyword Metrics from DB
    const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
      where: { projectId }
    });

    // 2. AI assigns keywords to pages using real volume data
    const prompt = buildKeywordStrategyPrompt(
      businessContext,
      keywords,
      serviceKeywords,
      locationMetrics,
      pages
    );

    this.logger.log('Generating keyword strategy with AI...');

    const response = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`KeywordStrategy LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    const validatedData = this.validator.validate(parsed, KeywordStrategySchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'anthropic/claude-fable-5',
      usage: (response as any).usage || response.usage,
    };
  }
}
