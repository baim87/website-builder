import { Injectable } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { ASTNodeSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildComponentEditorPrompt } from '../prompts/builders/component-editor.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class ComponentEditorSkill implements Skill {
  readonly name = AISkill.COMPONENT_EDITOR;

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { targetNode, instruction } = input.context;

    const prompt = buildComponentEditorPrompt(targetNode, instruction);

    const result = await this.aiGateway.generateText(AIModel.CLAUDE_SONNET_3_5, {
      systemPrompt: 'You are an AI website component editor. Return ONLY valid JSON representing the updated ASTNode.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      temperature: 0.2,
      responseFormat: 'json',
    });

    const parsed = parseJsonFromLlm(result.text);

    // Validate the LLM output against our schema to ensure structural integrity
    const validatedData = this.validator.validate(parsed, ASTNodeSchema);

    // Safety check: preserve the original root ID if the LLM hallucinated a new one
    if (validatedData.id && targetNode.id && validatedData.id !== targetNode.id) {
      validatedData.id = targetNode.id;
    }

    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: AIModel.CLAUDE_SONNET_3_5,
    };
  }
}
