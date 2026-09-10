import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandKitSchema } from '../schemas/skill-outputs.schema';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import * as crypto from 'crypto';

@Injectable()
export class BrandKitGeneratorSkill implements Skill {
  readonly name = 'brand_kit_generator';
  private readonly logger = new Logger(BrandKitGeneratorSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, stylePrompt } = input.context;
    
    const fullJsonSchema = zodToJsonSchema(BrandKitSchema, 'BrandKit');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandKit']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const prompt = `You are a world-class brand agency and copywriter. Your job is to create a comprehensive, premium Brand Kit from scratch for a new contractor business based on their minimal details and a visual style prompt.
    
BUSINESS DETAILS:
${JSON.stringify(businessContext, null, 2)}

VISUAL STYLE PROMPT (from client):
"${stylePrompt}"

Generate a highly professional, 13-point Brand Kit that will be used as the foundation for an entire website build. 
The brand should feel premium, trustworthy, and tailored to their specific trade and target audience. 
Return your output using the provided structured tool.`;

    const result = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You are an elite brand identity expert. Output structured data via the provided tool.',
      messages: [
        { role: 'user', content: prompt }
      ],
      maxTokens: 8192,
      temperature: 0.7,
      schema: bareJsonSchema,
      schemaName: 'BrandKit',
    });

    this.logger.debug(`Raw LLM output: ${result.text}`);

    let parsed: any;
    try {
      let raw = result.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{') && raw.includes('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse LLM output as JSON: ${result.text}`);
      throw new Error(`BrandKitGenerator LLM returned unparseable output: ${result.text.substring(0, 200)}`);
    }

    const validatedData = this.validator.validate(parsed, BrandKitSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return { 
      data: validatedData, 
      hash,
      model: 'anthropic/claude-fable-5',
      usage: (result as any).usage || result.usage,
    };
  }
}
