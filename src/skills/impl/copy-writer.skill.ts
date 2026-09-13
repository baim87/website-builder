import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { buildCopyWriterPrompt } from '../prompts/builders/copy-writer.prompt';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';
@Injectable()
export class CopyWriterSkill implements Skill {
  readonly name = AISkill.COPY_WRITER;
  private readonly logger = new Logger(CopyWriterSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
    private readonly prisma: PrismaService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, businessContext, pageSlug } = input.context;

    if (!sectionType || !businessContext) {
      throw new Error('CopyWriterSkill requires sectionType and businessContext in context');
    }

    let locationMetrics: any[] = [];
    if (pageSlug === 'service-areas' && input.projectId) {
      locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
        where: { projectId: input.projectId }
      });
    }

    const schema = (SectionDataSchemaRegistry as any)[sectionType];
    let bareJsonSchema: any = undefined;
    if (schema) {
      const fullJsonSchema = zodToJsonSchema(schema, sectionType);
      bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[sectionType] : fullJsonSchema;
      // Strip $schema if present
      if (bareJsonSchema.$schema) {
        delete bareJsonSchema.$schema;
      }
    }

    const prompt = buildCopyWriterPrompt(input.context, locationMetrics, input.projectId);

    this.logger.log(`Generating copy for ${sectionType}...`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert United States brand strategist and copywriter specializing in local contractor and home-service businesses in the United States.Use natural, professional United States English and US terminology, spelling, tone, and conventions. Output strictly matching the requested JSON schema via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: sectionType,
    });

    const parsed = parseJsonFromLlm(response.text);

    let validatedData = parsed;
    if (schema) {
      validatedData = schema.parse(parsed);
    }

    // Business data grounding validation (e.g., prevent fake placeholders)
    this.validator.groundCheckContent(validatedData, businessContext);

    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
