import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class BrandStorySkill implements Skill {
  readonly name = AISkill.BRAND_STORY;
  private readonly logger = new Logger(BrandStorySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, brandStrategy } = input.context;

    const prompt = `You are an elite Brand Strategist and Copywriter for US home service contractors.

Generate a comprehensive Brand Story document based on the Business Context and Brand Strategy.
CRITICAL RULE: NEVER fabricate history. If the 'founderStory' is empty or not provided in the business context, omit the Origin & Founder Story section entirely. Do not make up a background.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Please generate a professional Markdown document titled "Brand Story" that includes the following sections (if applicable):
- Origin & Founder Story (ONLY if 'founderStory' is provided in context)
- Why We Exist
- What We Believe
- Customer's Problem & Transformation
- Brand Narrative
- Story Themes
- About Us Direction
- Storytelling Principles

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandStory generated markdown length: ${response.text.length}`);

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
