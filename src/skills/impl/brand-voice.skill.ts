import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildBrandVoicePrompt } from '../prompts/builders/brand-voice.prompt';
import { parseMarkdownFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class BrandVoiceSkill implements Skill {
  readonly name = AISkill.BRAND_VOICE;
  private readonly logger = new Logger(BrandVoiceSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy } = input.context;

    const prompt = buildBrandVoicePrompt(businessContext, brandStrategy);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandVoice generated markdown length: ${response.text.length}`);

    const cleanMarkdown = parseMarkdownFromLlm(response.text);

    const hash = crypto.createHash('sha256').update(cleanMarkdown).digest('hex');

    return {
      data: cleanMarkdown,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
