import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { DesignSystemSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class DesignSystemSkill implements Skill {
  readonly name = 'DesignSystem';
  private readonly logger = new Logger(DesignSystemSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const prompt = `Analyze this contractor business and generate a complete design system (colors, typography, spacing).
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Identity Constraints: ${JSON.stringify(input.context.brandIdentity)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "colors": {
    "primary": "string (hex)",
    "secondary": "string (hex)",
    "accent": "string (hex)",
    "background": "string (hex)",
    "text": "string (hex)"
  },
  "typography": {
    "headingFont": "string",
    "bodyFont": "string"
  },
  "spacing": {
    "small": "string (e.g. 8px)",
    "medium": "string",
    "large": "string"
  }
}`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
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
      throw new Error(`DesignSystem LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    // Normalize: handle nested wrappers
    if (!parsed.colors && parsed.designSystem) {
      parsed = parsed.designSystem;
    }
    if (!parsed.colors && parsed.design_system) {
      parsed = parsed.design_system;
    }

    const validatedData = this.validator.validate(parsed, DesignSystemSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
