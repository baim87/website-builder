import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { SeoMetadataSchema } from '../schemas/skill-outputs.schema';
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
    const prompt = `Generate SEO metadata for this contractor business homepage.
Business Context: ${JSON.stringify(input.context)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "title": "string",
  "description": "string",
  "keywords": ["string"],
  "ogImagePlaceholder": "string (description of ideal social share image)"
}`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 1000,
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

    // Normalize: handle nested wrappers
    if (!parsed.title && parsed.seoMetadata) {
      parsed = parsed.seoMetadata;
    }
    if (!parsed.title && parsed.seo_metadata) {
      parsed = parsed.seo_metadata;
    }

    const validatedData = this.validator.validate(parsed, SeoMetadataSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
