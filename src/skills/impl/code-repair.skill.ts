import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildCodeRepairPrompt } from '../prompts/builders/code-repair.prompt';
import { parseMarkdownFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class CodeRepairSkill implements Skill {
  readonly name = AISkill.CODE_REPAIR;
  private readonly logger = new Logger(CodeRepairSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { componentName, sectionType, brokenCode, errorLog, critique, themePreference, designTokens } = input.context;

    if (!brokenCode) {
      throw new Error('CodeRepairSkill requires brokenCode in context.');
    }
    
    const targetComponent = componentName || sectionType;
    
    const prompt = buildCodeRepairPrompt(
      targetComponent,
      brokenCode,
      errorLog,
      critique,
      themePreference,
      designTokens
    );

    this.logger.log(`Running CodeRepairSkill for ${targetComponent}`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You output ONLY raw React .tsx code. No markdown formatting, no explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
    });

    const code = parseMarkdownFromLlm(response.text);

    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      data: { code }, // Match original return shape for compiler repair compatibility
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
