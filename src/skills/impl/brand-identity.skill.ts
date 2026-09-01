import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandIdentitySchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class BrandIdentitySkill implements Skill {
  readonly name = 'brand_identity';
  private readonly logger = new Logger(BrandIdentitySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const prompt = `You are a Brand Identity expert for home service contractors.

Given this business context, generate a brand identity as a JSON object.

Business Context:
${JSON.stringify(input.context, null, 2)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "colors": {
    "primary": "#hexvalue",
    "secondary": "#hexvalue",
    "accent": "#hexvalue"
  },
  "typography": {
    "headingFont": "Font Family Name",
    "bodyFont": "Font Family Name"
  }
}`;

    const result = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [
        { role: 'user' as const, content: prompt }
      ],
      maxTokens: 1500,
      temperature: 0.3,
      responseFormat: 'json',
    });

    this.logger.debug(`Raw LLM output: ${result.text}`);

    // Normalize: if the LLM returned a flat structure, reshape it
    let parsed: any;
    try {
      let raw = result.text.trim();
      // Strip markdown fences if present
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse LLM output as JSON: ${result.text}`);
      throw new Error(`BrandIdentity LLM returned unparseable output: ${result.text.substring(0, 200)}`);
    }

    // Reshape flat structures into the expected nested format
    if (!parsed.colors && (parsed.primary || parsed.primaryColor || parsed.primary_color)) {
      this.logger.warn('LLM returned flat color structure, normalizing...');
      parsed = {
        colors: {
          primary: parsed.primary || parsed.primaryColor || parsed.primary_color || '#2E8BC0',
          secondary: parsed.secondary || parsed.secondaryColor || parsed.secondary_color || '#FFFFFF',
          accent: parsed.accent || parsed.accentColor || parsed.accent_color || '#333333',
        },
        typography: {
          headingFont: parsed.headingFont || parsed.heading_font || parsed.typography?.headingFont || 'Montserrat',
          bodyFont: parsed.bodyFont || parsed.body_font || parsed.typography?.bodyFont || 'Open Sans',
        },
      };
    }

    const validatedData = this.validator.validate(parsed, BrandIdentitySchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return { 
      data: validatedData, 
      hash,
      model: 'claude-fable-5',
    };
  }
}
