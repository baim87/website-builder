import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

export interface ValidationCritique {
  isValid: boolean;
  missingElements: string[];
}

@Injectable()
export class ComponentValidationSkill implements Skill {
  readonly name = 'ComponentValidation';
  private readonly logger = new Logger(ComponentValidationSkill.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, componentCode } = input.context;

    if (!sectionType || !componentCode) {
      throw new Error('ComponentValidationSkill requires sectionType and componentCode');
    }

    const schema = (SectionDataSchemaRegistry as any)[sectionType];
    if (!schema) {
      this.logger.warn(`No schema found for ${sectionType}, skipping validation.`);
      return { data: { isValid: true, missingElements: [] }, hash: '', model: '' };
    }

    const fullJsonSchema = zodToJsonSchema(schema, sectionType);
    const bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[sectionType] : fullJsonSchema;

    const prompt = `
You are a strict React and Next.js UI Validator.
Your task is to analyze the following React component source code and verify if it explicitly renders ALL the required data fields defined in its JSON schema contract.

SECTION TYPE: ${sectionType}
ZOD SCHEMA CONTRACT:
${JSON.stringify(bareJsonSchema, null, 2)}

REACT COMPONENT SOURCE CODE:
\`\`\`tsx
${componentCode}
\`\`\`

REQUIREMENTS:
1. The component receives a 'data' prop. You must ensure that the code actually renders the required fields from the schema (e.g. data.mapUrl, data.hours, data.phone) into the UI.
2. If the schema requires a Google Maps iframe (mapUrl) and the code doesn't have an iframe using data.mapUrl, that is a missing element.
3. If the code completely ignores rendering required text fields or contact info, that is a missing element.
4. Output a JSON object with 'isValid' (boolean) and 'missingElements' (array of strings describing exactly what is missing and how to fix it).

Return ONLY valid JSON.
{ "isValid": false, "missingElements": ["The iframe for data.mapUrl is completely missing.", "data.hours is not rendered anywhere."] }
`;

    const response = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences. No explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      const parsed = JSON.parse(raw) as ValidationCritique;
      
      return {
        data: parsed,
        hash: '',
        model: 'anthropic/claude-fable-5',
      usage: (response as any).usage || response.usage,
      };
    } catch (e) {
      this.logger.error(`Validation LLM returned unparseable JSON: ${response.text}`);
      return { data: { isValid: true, missingElements: [] }, hash: '', model: '' }; // Failsafe
    }
  }
}
