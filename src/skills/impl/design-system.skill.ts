import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { DesignSystemSchema } from '../schemas/skill-outputs.schema';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildDesignSystemPrompt } from '../prompts/builders/design-system.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class DesignSystemSkill implements Skill {
  readonly name = AISkill.DESIGN_SYSTEM;
  private readonly logger = new Logger(DesignSystemSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandVisual, themePreference } = input.context;

    const prompt = buildDesignSystemPrompt(businessContext, brandVisual, themePreference);

    const fullJsonSchema = zodToJsonSchema(DesignSystemSchema, 'DesignSystem');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['DesignSystem']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are a design system expert. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'DesignSystem',
    });

    this.logger.debug(`Raw LLM output: ${response.text}`);

    let parsed = parseJsonFromLlm(response.text);

    // Normalize: handle nested wrappers (safety net)
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
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
