import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class BrandPositioningSkill implements Skill {
  readonly name = AISkill.BRAND_POSITIONING;
  private readonly logger = new Logger(BrandPositioningSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy } = input.context;

    const prompt = `You are an elite Brand Strategist for US home service contractors.

Based on the provided Business Context and Brand Strategy, generate a comprehensive Brand Positioning document.
Do not fabricate facts. Focus on positioning the brand effectively in its market.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Please generate a professional Markdown document titled "Brand Positioning" that includes the following sections:
- Category & Positioning Statement
- Market Position
- Primary & Supporting Differentiators
- Customer Problem & Fear
- Competitive Context (competitors, patterns, whitespace)
- Proof Points & Trust Signals

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandPositioning generated markdown length: ${response.text.length}`);

    let raw = response.text.trim();
    if (raw.startsWith('```markdown')) {
      raw = raw.replace(/^```markdown\s*/i, '').replace(/\s*```$/i, '');
    } else if (raw.startsWith('```')) {
      raw = raw.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    return {
      data: raw,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
