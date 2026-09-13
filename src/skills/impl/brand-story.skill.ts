import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';
import { buildBrandStorySchema } from '../schemas/skill-outputs.schema';
import { buildBrandStoryPrompt } from '../prompts/builders/brand-story.prompt';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

@Injectable()
export class BrandStorySkill implements Skill {
  readonly name = AISkill.BRAND_STORY;
  private readonly logger = new Logger(BrandStorySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy } = input.context;
    const brandInputs = businessContext?.brandIdentityInputs || {};

    // Determine if optional fields are available.
    // The user submitting 'skip', an empty string, or the field being absent all result in omission.
    const founderStory = brandInputs.founderStory;
    const hasFounderStory = founderStory &&
      typeof founderStory === 'string' &&
      founderStory.trim().toLowerCase() !== 'skip' &&
      founderStory.trim().length > 0;

    const BrandStorySchema = buildBrandStorySchema(hasFounderStory);

    // Extract clean tool schema
    const fullJsonSchema = zodToJsonSchema(BrandStorySchema, 'BrandStory');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandStory']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const prompt = buildBrandStoryPrompt(businessContext, brandStrategy, founderStory);

    this.logger.log(`BrandStorySkill: hasFounderStory=${hasFounderStory}. Building schema.`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'BrandStory',
    });

    const parsed = parseJsonFromLlm(response.text);

    const validatedData = this.validator.validate(parsed, BrandStorySchema);

    // Render the structured JSON output to Markdown server-side
    const markdown = this.renderToMarkdown(validatedData, hasFounderStory);

    this.logger.debug(`BrandStory generated markdown length: ${markdown.length}`);

    const hash = crypto.createHash('sha256').update(markdown).digest('hex');

    return {
      data: markdown,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }

  private renderToMarkdown(data: any, hasFounderStory: boolean): string {
    const lines: string[] = [];

    lines.push('# Brand Story');
    lines.push('');

    if (hasFounderStory && data.originAndFounderStory) {
      lines.push('## Origin & Founder Story');
      lines.push(data.originAndFounderStory);
      lines.push('');
    }

    lines.push('## Why We Exist');
    lines.push(data.whyWeExist);
    lines.push('');

    lines.push('## What We Believe');
    lines.push(data.whatWeBelieve);
    lines.push('');

    lines.push("## The Customer's Problem & Transformation");
    lines.push(data.customerProblemAndTransformation);
    lines.push('');

    lines.push('## Brand Narrative');
    lines.push(data.brandNarrative);
    lines.push('');

    if (data.storyThemes?.length > 0) {
      lines.push('## Story Themes');
      data.storyThemes.forEach((theme: string) => lines.push(`- ${theme}`));
      lines.push('');
    }

    lines.push('## About Us Direction');
    lines.push(data.aboutUsDirection);
    lines.push('');

    if (data.storytellingPrinciples?.length > 0) {
      lines.push('## Storytelling Principles');
      data.storytellingPrinciples.forEach((p: string) => lines.push(`- ${p}`));
      lines.push('');
    }

    return lines.join('\n');
  }
}
