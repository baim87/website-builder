import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildCssStylePrompt } from '../prompts/builders/css-style.prompt';
import { parseCssFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class CSSStyleSkill implements Skill {
  readonly name = AISkill.CSS_STYLE;
  private readonly logger = new Logger(CSSStyleSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { designSystem, themePreference } = input.context;

    if (!designSystem || !designSystem.colors || !designSystem.typography) {
      throw new Error('CSSStyleSkill requires designSystem in context');
    }

    const prompt = buildCssStylePrompt(designSystem, themePreference);

    this.logger.log(`Generating global CSS configuration...`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You output ONLY raw CSS code. Do not wrap in markdown fences. Do not explain anything.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 8192,
    });

    const css = parseCssFromLlm(response.text);

    try {
      this.validator.validateCSS(css);
    } catch (error) {
      this.logger.error(`Validation failed for generated CSS`, error);
      throw error;
    }

    const hash = crypto.createHash('sha256').update(css).digest('hex');

    return {
      data: css,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
