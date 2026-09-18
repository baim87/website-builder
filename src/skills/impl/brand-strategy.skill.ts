import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildBrandStrategyPrompt } from '../prompts/builders/brand-strategy.prompt';
import { parseMarkdownFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class BrandStrategySkill implements Skill {
  readonly name = AISkill.BRAND_STRATEGY;
  private readonly logger = new Logger(BrandStrategySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext } = input.context;

    const prompt = buildBrandStrategyPrompt(businessContext);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandStrategy generated markdown length: ${response.text.length}`);

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
