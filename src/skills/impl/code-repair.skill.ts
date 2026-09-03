import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';

@Injectable()
export class CodeRepairSkill implements Skill {
  readonly name = 'CodeRepair';
  private readonly logger = new Logger(CodeRepairSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { brokenCode, errorLog, componentName } = input.context;

    if (!brokenCode || !errorLog || !componentName) {
      throw new Error('CodeRepairSkill requires brokenCode, errorLog, and componentName in context.');
    }

    const prompt = `
You are an expert React and Next.js developer.
You generated a component named "${componentName}", but it caused a build error in the Next.js compilation step.

COMPILER ERROR LOG:
-------------------
${errorLog}
-------------------

BROKEN COMPONENT SOURCE CODE:
-------------------
${brokenCode}
-------------------

YOUR TASK:
Fix the component so it compiles successfully.
1. The component must still be named "${componentName}".
2. It must still accept the \`{ data }: any\` prop.
3. Fix whatever syntax or type error caused the build to fail.
4. Return ONLY the raw fixed .tsx code. No markdown fences, no explanations. Just the code.
`;

    this.logger.log(`Running CodeRepairSkill for ${componentName}`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY raw React .tsx code. No markdown formatting, no explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
    });

    let code = response.text.trim();

    if (code.startsWith('```')) {
      const lines = code.split('\n');
      if (lines[0].startsWith('```')) lines.shift();
      if (lines[lines.length - 1].startsWith('```')) lines.pop();
      code = lines.join('\n').trim();
    }

    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      data: { code },
      hash,
      model: 'claude-fable-5',
    };
  }
}
