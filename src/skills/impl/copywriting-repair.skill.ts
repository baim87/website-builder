import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildCopywritingRepairPrompt } from '../prompts/builders/copywriting-repair.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class CopywritingRepairSkill implements Skill {
  readonly name = AISkill.COPYWRITING_REPAIR;
  private readonly logger = new Logger(CopywritingRepairSkill.name);

  constructor(
    private readonly aiService: AIGatewayService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brokenData, critique, brandStrategy, brandVoice } = input.context;

    const prompt = buildCopywritingRepairPrompt(sectionType, brokenData, critique, brandStrategy, brandVoice);

    const response = await this.aiService.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences. Just the raw JSON object that exactly matches the input structure.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 8192,
      responseFormat: 'json'
    });

    try {
      const fixedData = parseJsonFromLlm(response.text);

      this.logger.log(`Successfully generated copywriting repair for ${sectionType}`);

      return {
        data: { fixedData },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
        },
        model: AIModel.CLAUDE_FABLE_5,
        hash: 'placeholder',
      };
    } catch (e: any) {
      this.logger.error(`Failed to parse JSON: ${e.message}`);
      throw new Error(`Failed to parse AI repair response: ${e.message} \nRaw: ${response.text}`);
    }
  }
}
