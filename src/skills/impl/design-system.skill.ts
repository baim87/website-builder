import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { DesignSystemSchema } from '../schemas/skill-outputs.schema';
import { getThemeById } from '../constants/theme-definitions.constant';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

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
    const theme = themePreference ? getThemeById(themePreference) : undefined;
    
    let themeHints = '';
    if (theme && theme.designSystemHints && !theme.designSystemHints.includes('TODO')) {
      themeHints = `\nTHEME AESTHETIC (${theme.label}):\n${theme.designSystemHints}\n`;
    }

    // Convert Zod schema to JSON Schema for Claude's tool_use
    const fullJsonSchema = zodToJsonSchema(DesignSystemSchema, 'DesignSystem');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['DesignSystem']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const prompt = `Analyze this contractor business and generate a complete design system (colors, typography, spacing) using the provided tool.
Business Context: ${JSON.stringify(businessContext)}
Brand Identity Constraints: ${brandVisual || 'Not provided'}${themeHints}

AESTHETICS RULE: The color palette MUST align perfectly with the brand's logo and identity. You may use dark colors if the logo/brand dictates it. You MUST ensure strict contrast (e.g., light text on dark backgrounds, or dark text on light backgrounds) for readability. Avoid generic SaaS defaults; focus on a professional, trustworthy contractor aesthetic. CRITICAL: If there is a conflict between the THEME AESTHETIC and the Brand Identity Constraints (e.g. the theme suggests a green primary color, but the brand identity dictates blue), the Brand Identity Constraints ALWAYS win for the primary and secondary colors. The Theme Aesthetic should strictly govern the backgrounds, dark surfaces, and overall vibe.

FIELD GUIDANCE (for the tool output):
- colors.primary: The brand's main action/CTA color. Used for buttons, links, highlights. Must be a hex value.
- colors.secondary: The brand's secondary color. May be light or dark based on user input. Hex value.
- colors.accent: A supporting color for badges, borders, or subtle highlights. Hex value.
- colors.background: The main page background. Usually light (white or near-white). Hex value.
- colors.text: The default body text color. Must have strong contrast against the background. Hex value.
- colors.surfaceDark: A generated DARK contrasting color used for overlays and dark sections (footers, hero overlays). MUST be dark enough (luminance < 0.3) so white text is readable on top. You MUST invent this complementary dark color if the user provides a light secondary color. Hex value.
- colors.headerBg: Background color for the Header. Pass through from Brand Identity if available. Hex value.
- colors.footerBg: Background color for the Footer. Pass through from Brand Identity if available. Hex value.
- typography.headingFont: A Google Fonts heading font family name.
- typography.bodyFont: A Google Fonts body font family name.
- spacing.small: e.g. "8px"
- spacing.medium: e.g. "16px"
- spacing.large: e.g. "32px"

Output the design system via the provided tool.`;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are a design system expert. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'DesignSystem',
    });

    this.logger.debug(`Raw LLM output: ${response.text}`);

    let parsed: any;
    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{') && raw.includes('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`DesignSystem LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

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

