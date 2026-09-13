import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PageSeoSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildSeoMetadataPrompt } from '../prompts/builders/seo-metadata.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class SeoMetadataSkill implements Skill {
  readonly name = AISkill.SEO_METADATA;
  private readonly logger = new Logger(SeoMetadataSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, pageSlug, keywordTarget, projectAssets = [], brandPositioning, brandMessaging } = input.context;
    
    if (!pageSlug || !keywordTarget || !keywordTarget.primaryKeyword) {
      throw new Error('SeoMetadataSkill requires pageSlug and keywordTarget with a primaryKeyword');
    }

    const primaryKeyword = keywordTarget.primaryKeyword.keyword;
    const secondaryKeywords = keywordTarget.secondaryKeywords?.map((k: any) => k.keyword) || [];
    const availableAssets = projectAssets.map((a: any) => `ASSET:${a.id} - ${a.prompt}`).join('\n');

    const prompt = buildSeoMetadataPrompt(
      businessContext,
      pageSlug,
      primaryKeyword,
      secondaryKeywords,
      availableAssets,
      brandPositioning,
      brandMessaging
    );

    const fullJsonSchema = zodToJsonSchema(PageSeoSchema, 'PageSeo');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['PageSeo']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an elite SEO specialist. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'PageSeo',
    });

    this.logger.debug(`Raw LLM output: ${response.text}`);

    const parsed = parseJsonFromLlm(response.text);

    const validatedData = this.validator.validate(parsed, PageSeoSchema);
    
    // Programmatic check: Ensure primary keyword is in title and H1
    this.validator.validateKeywordPresence(validatedData.title, validatedData.h1, primaryKeyword);

    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
