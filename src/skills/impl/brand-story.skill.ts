import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { z } from 'zod';
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

    // Build the Zod schema dynamically.
    // If the user skipped a section, its field is NEVER added to the schema,
    // so the LLM is structurally prevented from fabricating content.
    const schemaShape: Record<string, z.ZodTypeAny> = {
      whyWeExist: z.string().describe('Why this company exists — the underlying mission and purpose.'),
      whatWeBelieve: z.string().describe('Core beliefs and values that drive the company.'),
      customerProblemAndTransformation: z.string().describe('The customer\'s problem before finding this company, and the positive transformation after.'),
      brandNarrative: z.string().describe('A compelling, cohesive brand narrative (2-3 paragraphs).'),
      storyThemes: z.array(z.string()).describe('3-5 recurring story themes to reinforce consistently.'),
      aboutUsDirection: z.string().describe('Strategic direction for writing the About Us page.'),
      storytellingPrinciples: z.array(z.string()).describe('4-6 guiding principles for brand storytelling.'),
    };

    if (hasFounderStory) {
      schemaShape.originAndFounderStory = z.string().describe(
        'The origin and founder story based on the provided user input. Do NOT embellish or add facts not present in the user input.'
      );
    }

    const BrandStorySchema = z.object(schemaShape);

    // Extract clean tool schema
    const fullJsonSchema = zodToJsonSchema(BrandStorySchema, 'BrandStory');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandStory']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const founderSection = hasFounderStory
      ? `FOUNDER STORY (provided by user — use this, do NOT embellish):\n${founderStory}`
      : `FOUNDER STORY: Not provided. The originAndFounderStory field is OMITTED from the schema. Do not fabricate any founder history.`;

    const prompt = `You are an elite Brand Strategist and Copywriter for US home service contractors.

Generate a comprehensive Brand Story document based on the Business Context and Brand Strategy.

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND STRATEGY:
${brandStrategy}

${founderSection}

RULES:
1. All content must be grounded in the actual business context provided above.
2. Do NOT fabricate facts, histories, years founded, or personal anecdotes unless explicitly provided.
3. Be bold, confident, and persuasive — this is not a corporate press release.
4. Write for US home service contractors. Tone should match the brand personality.`;

    this.logger.log(`BrandStorySkill: hasFounderStory=${hasFounderStory}. Building schema with ${Object.keys(schemaShape).length} fields.`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'BrandStory',
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse BrandStory LLM output: ${response.text.substring(0, 200)}`);
      throw new Error('BrandStory LLM returned unparseable JSON output');
    }

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
