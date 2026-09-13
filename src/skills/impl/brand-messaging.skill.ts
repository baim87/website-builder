import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class BrandMessagingSkill implements Skill {
  readonly name = AISkill.BRAND_MESSAGING;
  private readonly logger = new Logger(BrandMessagingSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy, brandPositioning } = input.context;

    const prompt = `You are an elite Brand Strategist for US home service contractors.

Generate a comprehensive Brand Messaging document based on the Business Context, Brand Strategy, and Brand Positioning.
Do not fabricate facts. Focus on actionable, customer-facing messaging.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Brand Positioning (if available):
${brandPositioning || 'Not provided'}

Please generate a professional Markdown document titled "Brand Messaging" that includes the following sections:
- Core Message & Value Proposition
- Brand Promise
- Key Differentiators & Proof Points
- Customer-Facing Messages (hero, CTA, trust, why-us, about-us, service)
- Messaging Pillars (3)
- Key Phrases
- Messages to Avoid

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandMessaging generated markdown length: ${response.text.length}`);

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
