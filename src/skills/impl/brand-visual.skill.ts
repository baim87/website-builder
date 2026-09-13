import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';

@Injectable()
export class BrandVisualSkill implements Skill {
  readonly name = AISkill.BRAND_VISUAL;
  private readonly logger = new Logger(BrandVisualSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { context } = input;
    const { businessContext, brandStrategy, extractedBrand } = context;

    const prompt = `You are a world-class brand strategist for US local contractors.

Your task is to create a comprehensive Brand Visual document (Markdown format) based on the provided Brand Strategy.

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND STRATEGY:
${brandStrategy}

EXTRACTED COLORS FROM LOGO (if any):
${extractedBrand ? JSON.stringify(extractedBrand, null, 2) : 'None'}

OUTPUT FORMAT:
Return a JSON object containing:
1. "markdown": A well-structured markdown document (\`brand-visual.md\`) that includes:
   - Visual Strategy & Personality
   - Logo Direction (type, concept, characteristics, avoid)
   - Color Direction (primary territory, secondary, accent, avoid)
   - Typography (primary, secondary, personality)
   - Photography direction
   - Iconography & Graphic Language
   - Brand Recognition (trucks, uniforms, yard signs, website, social)
   - Visual North Star

2. "recommendedTheme": The best matching theme ID from the following list:
   - 'editorial-luxury'
   - 'modern-minimalist'
   - 'soft-organic'
   - 'dark-bento'
   - 'awesomic'
   - 'mercury'

RULES:
1. If EXTRACTED COLORS FROM LOGO exist, you MUST preserve them in your Color Direction.
2. The visual style must align with the brand personality.
3. Recommend the theme that best matches the Visual Strategy.

Return ONLY the raw JSON object without any code blocks or wrapper JSON.`;

    this.logger.log(`Generating brand visual markdown and theme using ${AIModel.CLAUDE_FABLE_5}`);

    const result = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an elite brand identity expert. Output ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8192,
      temperature: 0.7,
    });

    let raw = result.text.trim();
    if (raw.startsWith('\`\`\`json')) {
      raw = raw.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (raw.startsWith('\`\`\`')) {
      raw = raw.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logger.error('Failed to parse Brand Visual output');
      throw new Error('Invalid JSON from Brand Visual Skill');
    }

    return {
      data: parsed.markdown,
      metadata: { recommendedTheme: parsed.recommendedTheme },
      hash: 'brand-visual-' + Date.now(),
      model: AIModel.CLAUDE_FABLE_5,
      usage: result.usage,
    };
  }
}
