import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandVisualOutputSchema } from '../schemas/skill-outputs.schema';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { buildBrandVisualPrompt } from '../prompts/builders/brand-visual.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class BrandVisualSkill implements Skill {
  readonly name = AISkill.BRAND_VISUAL;
  private readonly logger = new Logger(BrandVisualSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy, extractedBrand } = input.context;

    const prompt = buildBrandVisualPrompt(businessContext, brandStrategy, extractedBrand);

    const fullJsonSchema = zodToJsonSchema(BrandVisualOutputSchema, 'BrandVisualOutput');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandVisualOutput']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    this.logger.log(`Generating brand visual markdown and theme using ${AIModel.CLAUDE_FABLE_5}`);

    const result = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an elite brand identity expert. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8192,
      temperature: 0.7,
      schema: bareJsonSchema,
      schemaName: 'BrandVisualOutput',
    });

    let parsed: any;
    try {
      parsed = parseJsonFromLlm(result.text);
    } catch (e) {
      this.logger.error(`Failed to parse Brand Visual output: ${result.text.substring(0, 200)}`);
      throw new Error('Invalid JSON from Brand Visual Skill');
    }

    const validatedData = this.validator.validate(parsed, BrandVisualOutputSchema);

    return {
      data: {
        markdown: validatedData.markdown,
        recommendedTheme: validatedData.recommendedTheme,
      },
      hash: 'brand-visual-' + Date.now(),
      model: AIModel.CLAUDE_FABLE_5,
      usage: result.usage,
    };
  }
}
