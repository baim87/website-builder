import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandVoiceSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class BrandVoiceSkill implements Skill {
  readonly name = 'BrandVoice';
  private readonly logger = new Logger(BrandVoiceSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const prompt = `Analyze this contractor business and generate a brand voice profile.
Business Context: ${JSON.stringify(input.context)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "tone": "description of the brand tone",
  "vocabulary": ["word1", "word2", "word3"],
  "rules": ["rule1", "rule2", "rule3"]
}`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
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
      throw new Error(`BrandVoice LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    // Normalize: handle nested wrappers like { brandVoice: { tone, ... } }
    if (!parsed.tone && parsed.brandVoice) {
      parsed = parsed.brandVoice;
    }
    if (!parsed.tone && parsed.brand_voice) {
      parsed = parsed.brand_voice;
    }

    const validatedData = this.validator.validate(parsed, BrandVoiceSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
