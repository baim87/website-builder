import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { BrandVisualOutputSchema } from '../schemas/skill-outputs.schema';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

@Injectable()
export class BrandVisualSkill implements Skill {
  readonly name = AISkill.BRAND_VISUAL;
  private readonly logger = new Logger(BrandVisualSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { context } = input;
    const { businessContext, brandStrategy, extractedBrand } = context;

    const brandInputs = businessContext?.brandIdentityInputs || {};

    // Resolve optional fields — filter out 'skip' or empty strings so the LLM never sees them
    const isSkipped = (val: any) => !val || (typeof val === 'string' && val.trim().toLowerCase() === 'skip');
    const colorPreferences = isSkipped(brandInputs.colorPreferences) ? null : brandInputs.colorPreferences;
    const existingLogoFeedback = isSkipped(brandInputs.existingLogoFeedback) ? null : brandInputs.existingLogoFeedback;

    const colorSection = colorPreferences
      ? `COLOR PREFERENCES (from user):\n${colorPreferences}`
      : `COLOR PREFERENCES: Not provided. Derive color direction purely from the Brand Strategy and Visual Direction.`;

    const logoFeedbackSection = existingLogoFeedback
      ? `EXISTING LOGO FEEDBACK (from user):\n${existingLogoFeedback}`
      : '';

    const prompt = `You are a world-class brand strategist for US local contractors.\n\nYour task is to create a comprehensive Brand Visual document (Markdown format) based on the provided Brand Strategy.\n\nBUSINESS CONTEXT:\n${JSON.stringify(businessContext, null, 2)}\n\nBRAND STRATEGY:\n${brandStrategy}\n\nEXTRACTED COLORS FROM LOGO (if any):\n${extractedBrand ? JSON.stringify(extractedBrand, null, 2) : 'None'}\n\n${colorSection}\n${logoFeedbackSection ? '\n' + logoFeedbackSection : ''}\n\nOUTPUT FORMAT:\nReturn a JSON object containing:\n1. "markdown": A well-structured markdown document (\`brand-visual.md\`) that includes:\n   - Visual Strategy & Personality\n   - Logo Direction (type, concept, characteristics, avoid)\n   - Color Direction (primary territory, secondary, accent, avoid)\n   - Typography (primary, secondary, personality)\n   - Photography direction\n   - Iconography & Graphic Language\n   - Brand Recognition (trucks, uniforms, yard signs, website, social)\n   - Visual North Star\n\n2. "recommendedTheme": The best matching theme ID from the following list:\n   - 'editorial-luxury'\n   - 'modern-minimalist'\n   - 'soft-organic'\n   - 'dark-bento'\n   - 'awesomic'\n   - 'mercury'\n\nRULES:\n1. If EXTRACTED COLORS FROM LOGO exist, you MUST preserve them in your Color Direction.\n2. The visual style must align with the brand personality.\n3. Recommend the theme that best matches the Visual Strategy.\n\nReturn ONLY the raw JSON object without any code blocks or wrapper JSON.`;


    this.logger.log(`Generating brand visual markdown and theme using ${AIModel.CLAUDE_FABLE_5}`);

    const fullJsonSchema = zodToJsonSchema(BrandVisualOutputSchema, 'BrandVisualOutput');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandVisualOutput']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const result = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an elite brand identity expert. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8192,
      temperature: 0.7,
      schema: bareJsonSchema,
      schemaName: 'BrandVisualOutput',
    });

    let raw = result.text.trim();
    if (raw.startsWith('\`\`\`json')) {
      raw = raw.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (raw.startsWith('\`\`\`')) {
      raw = raw.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }
    
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
    } catch (e) {
      this.logger.error('Failed to parse Brand Visual output');
      throw new Error('Invalid JSON from Brand Visual Skill');
    }

    const validatedData = this.validator.validate(parsed, BrandVisualOutputSchema);

    return {
      data: validatedData.markdown,
      metadata: { recommendedTheme: validatedData.recommendedTheme },
      hash: 'brand-visual-' + Date.now(),
      model: AIModel.CLAUDE_FABLE_5,
      usage: result.usage,
    };
  }
}
