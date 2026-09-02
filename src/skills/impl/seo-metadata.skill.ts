import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PageSeoSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class SeoMetadataSkill implements Skill {
  readonly name = 'SeoMetadata';
  private readonly logger = new Logger(SeoMetadataSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, pageSlug, keywordTarget } = input.context;
    
    if (!pageSlug || !keywordTarget || !keywordTarget.primaryKeyword) {
      throw new Error('SeoMetadataSkill requires pageSlug and keywordTarget with a primaryKeyword');
    }

    const primaryKeyword = keywordTarget.primaryKeyword.keyword;
    const secondaryKeywords = keywordTarget.secondaryKeywords?.map((k: any) => k.keyword) || [];

    const prompt = `Generate SEO metadata for a specific page of this contractor website.

BUSINESS CONTEXT:
${JSON.stringify(businessContext)}

PAGE SLUG: /${pageSlug}

TARGET KEYWORDS:
Primary Keyword: "${primaryKeyword}" (MUST be used in Title and H1)
Secondary Keywords: ${secondaryKeywords.join(', ')}

RULES:
1. The title MUST be 30-60 characters and MUST contain the Primary Keyword.
2. The description MUST be 120-160 characters.
3. The H1 MUST contain the Primary Keyword.
4. Make it compelling for a user searching for these services.

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "slug": "${pageSlug}",
  "title": "string (30-60 chars, includes primary keyword)",
  "description": "string (120-160 chars)",
  "h1": "string (includes primary keyword)",
  "keywords": ["string (primary + secondaries)"],
  "ogTitle": "string",
  "ogDescription": "string",
  "canonicalPath": "/${pageSlug}"
}`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    this.logger.debug(`Raw LLM output: ${response.text}`);

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
      throw new Error(`SeoMetadata LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    const validatedData = this.validator.validate(parsed, PageSeoSchema);
    
    // Programmatic check: Ensure primary keyword is in title and H1
    this.validator.validateKeywordPresence(validatedData.title, validatedData.h1, primaryKeyword);

    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
