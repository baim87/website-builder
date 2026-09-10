import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { buildCopyWriterPrompt } from '../prompts/builders/copy-writer.prompt';
@Injectable()
export class CopyWriterSkill implements Skill {
  readonly name = 'CopyWriter';
  private readonly logger = new Logger(CopyWriterSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
    private readonly prisma: PrismaService,
  ) {}

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

    const response = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You are an expert copywriter. Output strictly matching the requested JSON schema via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: sectionType,
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      if (!raw) {
         this.logger.warn(`[CopyWriter] Raw text was empty! Fallback parsing will result in empty object.`);
      } else {
         // this.logger.debug(`[CopyWriter] Raw LLM output: ${raw.substring(0, 500)}...`);
      }
      
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{') && raw.includes('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw || '{}');
    } catch (e) {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`CopyWriter LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

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
      model: 'anthropic/claude-fable-5',
      usage: (response as any).usage || response.usage,
    };
  }
}
