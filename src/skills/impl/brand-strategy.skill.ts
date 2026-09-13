import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class BrandStrategySkill implements Skill {
  readonly name = AISkill.BRAND_STRATEGY;
  private readonly logger = new Logger(BrandStrategySkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext } = input.context;

    const prompt = `You are an elite Brand Strategist for US home service contractors.

Synthesize the following raw interview inputs and business context into a comprehensive Brand Strategy document.
Do not fabricate facts. Synthesize raw answers into strategic conclusions. If answers conflict, resolve intelligently.
Distinguish user-provided facts vs AI interpretation.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Please generate a professional Markdown document titled "Brand Strategy" that includes the following sections:
- Brand Definition & Essence
- Core Brand Promise
- Target Customer (primary + desired)
- Customer Needs & Fears
- Brand Values
- Brand Personality (We Are / We Are Not)
- Brand Ambition
- Brand North Star

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Brand Strategist. Output professional Markdown.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
    });

    this.logger.debug(`BrandStrategy generated markdown length: ${response.text.length}`);

    let raw = response.text.trim();
    // Safely remove markdown fences if the LLM adds them
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
