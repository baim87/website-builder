import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { KeywordsService } from '../../keywords/keywords.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordStrategySchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class KeywordStrategySkill implements Skill {
  readonly name = 'KeywordStrategy';
  private readonly logger = new Logger(KeywordStrategySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly keywordsService: KeywordsService,
    private readonly prisma: PrismaService,
    private readonly validator: OutputValidatorService,
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
    
    // Also fetch per-service keywords
    const serviceKeywords = [];
    const servicesList = businessContext.services || [];
    
    for (const service of servicesList) {
      // Handle services if they are objects or strings
      const name = typeof service === 'string' ? service : (service.name || service.title || 'Unknown Service');
      if (name !== 'Unknown Service') {
        try {
          const kws = await this.keywordsService.getKeywords(name, businessContext.location);
          serviceKeywords.push({ service: name, keywords: kws });
        } catch (error) {
          this.logger.warn(`Failed to fetch keywords for service: ${name}`, error);
        }
      }
    }
    
    // 1.5 Fetch Radius Location Keyword Metrics from DB
    const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
      where: { projectId }
    });

    // 2. AI assigns keywords to pages using real volume data
    const prompt = `You are an SEO strategist. Assign target keywords to the pages for a contractor website.

BUSINESS CONTEXT:
Trade: ${businessContext.trade}
Location: ${businessContext.location}

REAL KEYWORD DATA (from Google Ads, with actual monthly search volumes):
${JSON.stringify(keywords.slice(0, 50))} // Limiting to top 50 to avoid massive token usage

SERVICE-SPECIFIC KEYWORDS:
${JSON.stringify(serviceKeywords.map(sk => ({ service: sk.service, keywords: sk.keywords.slice(0, 10) })))}

LOCATION RADIUS KEYWORD METRICS (For Service Area Pages/Cards):
${JSON.stringify(locationMetrics)}

PAGES TO ASSIGN:
${JSON.stringify(pages)}

RULES:
- Each page gets exactly 1 primary keyword (highest volume, most relevant to the page's intent)
- Each page gets 2-4 secondary keywords
- DO NOT assign the same primary keyword to multiple pages (no keyword cannibalization)
- Match search intent: "home" = broad commercial, "services/x" = specific service, "service-areas/x" = local
- Prioritize keywords with higher search volume, but make sure they are highly relevant to the specific page.

You MUST respond with ONLY a JSON object in this EXACT structure:
{
  "pages": [
    {
      "slug": "string (the page slug)",
      "primaryKeyword": { "keyword": "string", "volume": number },
      "secondaryKeywords": [ { "keyword": "string", "volume": number } ],
      "searchIntent": "commercial" | "informational" | "local"
    }
  ]
}`;

    this.logger.log('Generating keyword strategy with AI...');

    const response = await this.aiGateway.generateText('claude-fable-5', {
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
      model: 'claude-fable-5',
    };
  }
}
