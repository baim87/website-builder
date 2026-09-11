import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { ASTNodeSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class ComponentEditorSkill implements Skill {
  readonly name = 'component_editor';
  private readonly logger = new Logger(ComponentEditorSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { targetNode, instruction } = input.context;

    const prompt = `You are an expert Frontend Developer and UI Designer for a website builder.
The user has selected a specific component (AST Node) on their website and provided instructions on how to modify it.

Current Component JSON:
${JSON.stringify(targetNode, null, 2)}

User Instruction:
"${instruction}"

Your job is to apply the user's instruction and return the mutated Component JSON.
You must return the ENTIRE updated component JSON, including its 'id' and 'children' (if any), preserving the structure exactly as expected by the ASTNode schema.

Rules:
1. Do NOT change the 'id' of the component or any of its children.
2. Only modify the 'props', 'type', or 'children' necessary to fulfill the request.
3. If the user asks to change the text, update the relevant string in props.data or children.
4. Output valid JSON only, representing the single ASTNode object.`;

    const result = await this.aiGateway.generateText('anthropic/claude-3.5-sonnet', {
      systemPrompt: 'You are an AI website component editor. Return ONLY valid JSON representing the updated ASTNode.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let raw = result.text.trim();
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) raw = fenceMatch[1].trim();

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logger.error(`Failed to parse LLM output as JSON: ${raw}`);
      throw new Error('Failed to parse AI response as JSON.');
    }

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
      model: 'anthropic/claude-3.5-sonnet',
    };
  }
}
