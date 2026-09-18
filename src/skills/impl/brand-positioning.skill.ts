import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildBrandPositioningPrompt } from '../prompts/builders/brand-positioning.prompt';
import { parseMarkdownFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class BrandPositioningSkill implements Skill {
  readonly name = AISkill.BRAND_POSITIONING;
  private readonly logger = new Logger(BrandPositioningSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy } = input.context;

    const prompt = buildBrandPositioningPrompt(businessContext, brandStrategy);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandPositioning generated markdown length: ${response.text.length}`);

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
