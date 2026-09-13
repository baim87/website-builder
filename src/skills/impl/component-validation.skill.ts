import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildComponentValidationPrompt } from '../prompts/builders/component-validation.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

export interface ValidationCritique {
  isValid: boolean;
  missingElements: string[];
}

@Injectable()
export class ComponentValidationSkill implements Skill {
  readonly name = AISkill.COMPONENT_VALIDATION;
  private readonly logger = new Logger(ComponentValidationSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, componentCode } = input.context;

    if (!sectionType || !componentCode) {
      throw new Error('ComponentValidationSkill requires sectionType and componentCode');
    }

    const prompt = buildComponentValidationPrompt(sectionType, componentCode);

    if (!prompt) {
      this.logger.warn(`No schema found for ${sectionType}, skipping validation.`);
      return { data: { isValid: true, missingElements: [] }, hash: '', model: '' };
    }

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences. No explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    try {
      const parsed = parseJsonFromLlm(response.text) as ValidationCritique;
      
      return {
        data: parsed,
        hash: '',
        model: AIModel.CLAUDE_FABLE_5,
        usage: (response as any).usage || response.usage,
      };
    } catch (e) {
      this.logger.error(`Validation LLM returned unparseable JSON: ${response.text}`);
      return { data: { isValid: true, missingElements: [] }, hash: '', model: '' }; // Failsafe
    }
  }
}
