import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandIdentitySchema } from '../schemas/skill-outputs.schema';
import { getThemeById } from '../constants/theme-definitions.constant';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class BrandIdentitySkill implements Skill {
  readonly name = AISkill.BRAND_IDENTITY;
  private readonly logger = new Logger(BrandIdentitySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, themePreference } = input.context;
    const theme = themePreference ? getThemeById(themePreference) : undefined;

    let typoHints = '';
    if (theme && theme.typographyHints) {
      typoHints = `\nTYPOGRAPHY GUIDANCE for '${theme.label}':\n`;
      if (!theme.typographyHints.headingStyle.includes('TODO')) typoHints += `- Heading Style: ${theme.typographyHints.headingStyle}\n`;
      if (!theme.typographyHints.bodyStyle.includes('TODO')) typoHints += `- Body Style: ${theme.typographyHints.bodyStyle}\n`;
      if (typoHints === `\nTYPOGRAPHY GUIDANCE for '${theme.label}':\n`) typoHints = ''; // Nothing added
    }

    // Convert Zod schema to JSON Schema for Claude's tool_use
    const fullJsonSchema = zodToJsonSchema(BrandIdentitySchema, 'BrandIdentity');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandIdentity']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const prompt = `You are a Brand Identity expert for US home service contractors.

Given this business context, generate a brand identity using the provided tool. Pay special attention to 'brandIdentityInputs' if they exist, as they contain the owner's direct answers to our branding questionnaire. Remember: We are selling a home service (like remodeling, plumbing, fencing), NOT a physical product.

Business Context:
${JSON.stringify(businessContext, null, 2)}${typoHints}

CRITICAL RULE: If the Business Context explicitly contains 'extractedBrand' with colors, you MUST use those EXACT hex values for the primary and secondary colors. Do not alter them to fit a theme. The brand's official logo colors always take precedence. Additionally, pass through the 'headerBg' and 'footerBg' colors from 'extractedBrand' if they are present.

Output the brand identity via the provided tool.`;

    const result = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are a brand identity expert. Output structured data via the provided tool.',
      messages: [
        { role: 'user' as const, content: prompt }
      ],
      maxTokens: 8192,
      temperature: 0.3,
      schema: bareJsonSchema,
      schemaName: 'BrandIdentity',
    });

    this.logger.debug(`Raw LLM output: ${result.text}`);

    let parsed: any;
    try {
      let raw = result.text.trim();
      // Strip markdown fences if present (safety net)
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
      throw new Error(`BrandIdentity LLM returned unparseable output: ${result.text.substring(0, 200)}`);
    }

    // Reshape flat structures into the expected nested format (safety net)
    if (!parsed.colors && (parsed.primary || parsed.primaryColor || parsed.primary_color)) {
      this.logger.warn('LLM returned flat color structure, normalizing...');
      parsed = {
        colors: {
          primary: parsed.primary || parsed.primaryColor || parsed.primary_color || '#2E8BC0',
          secondary: parsed.secondary || parsed.secondaryColor || parsed.secondary_color || '#FFFFFF',
          accent: parsed.accent || parsed.accentColor || parsed.accent_color || '#333333',
        },
        typography: {
          headingFont: parsed.headingFont || parsed.heading_font || parsed.typography?.headingFont || 'Montserrat',
          bodyFont: parsed.bodyFont || parsed.body_font || parsed.typography?.bodyFont || 'Open Sans',
        },
      };
    }

    const validatedData = this.validator.validate(parsed, BrandIdentitySchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (result as any).usage || result.usage,
    };
  }
}
