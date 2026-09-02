import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import * as crypto from 'crypto';

@Injectable()
export class CSSStyleSkill implements Skill {
  readonly name = 'CSSStyle';
  private readonly logger = new Logger(CSSStyleSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { designSystem } = input.context;

    if (!designSystem || !designSystem.colors || !designSystem.typography) {
      throw new Error('CSSStyleSkill requires designSystem in context');
    }

    const prompt = `You are a Tailwind CSS configuration expert.
Given this design system, generate the CSS overrides for a modern Tailwind CSS v4 project.

DESIGN SYSTEM:
Colors: ${JSON.stringify(designSystem.colors, null, 2)}
Typography: ${JSON.stringify(designSystem.typography, null, 2)}

REQUIREMENTS:
1. Output valid CSS that defines CSS variables on the :root pseudo-class.
2. Define the @theme block to map these variables to Tailwind's color system (e.g., --color-primary: var(--color-primary);).
3. DO NOT include arbitrary pixel sizes for typography, use Tailwind's text scales.
4. The output must strictly follow this structure:

\`\`\`css
@import "tailwindcss";

:root {
  /* Define variables */
}

@theme {
  /* Override default theme */
}

@config {
  /* Disable arbitrary values by restricting the core plugins if necessary */
}
\`\`\`

Return ONLY the raw CSS code. No explanations.`;

    this.logger.log(`Generating global CSS configuration...`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY raw CSS code. Do not wrap in markdown fences. Do not explain anything.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 8192,
    });

    let css = response.text.trim();
    
    // Clean up if the LLM hallucinated markdown fences despite instructions
    const cssFenceMatch = css.match(/```(?:css)?\s*([\s\S]*?)\s*```/i);
    if (cssFenceMatch) {
      css = cssFenceMatch[1].trim();
    }

    try {
      this.validator.validateCSS(css);
    } catch (error) {
      this.logger.error(`Validation failed for generated CSS`, error);
      throw error;
    }

    const hash = crypto.createHash('sha256').update(css).digest('hex');

    return {
      data: css,
      hash,
      model: 'claude-fable-5',
    };
  }
}
