import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';

@Injectable()
export class CopywritingRepairSkill implements Skill {
  readonly name = 'CopywritingRepair';
  private readonly logger = new Logger(CopywritingRepairSkill.name);

  constructor(
    private readonly aiService: AIGatewayService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brokenData, critique } = input.context;

    const prompt = `
You are a senior copywriter for US home service contractors (roofers, plumbers, landscapers, etc.).
A visual QA AI has reviewed the website and found issues with the copywriting in the \`${sectionType}\` component.

Critique / Issues to fix:
${critique.map((c: string) => `- ${c}`).join('\n')}

Here is the current JSON data for this section:
${JSON.stringify(brokenData, null, 2)}

Your task is to fix the text to address the critique.
RULES:
1. ONLY modify the text fields (e.g. headlines, paragraphs, button labels).
2. DO NOT change the JSON structure or remove/add keys. Keep the exact same shape.
3. DO NOT change image URLs or asset IDs.
4. If the critique says it sounds like SaaS, rewrite it to sound rugged, professional, and targeted at local homeowners.
5. If there is lorem ipsum or generic placeholders, replace them with realistic contractor copy.

Return the completely fixed JSON object.
`;


    const response = await this.aiService.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences. Just the raw JSON object that exactly matches the input structure.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 8192,
      responseFormat: 'json'
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      const fixedData = JSON.parse(raw);

      this.logger.log(`Successfully generated copywriting repair for ${sectionType}`);

      return {
        data: { fixedData },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
        },
        model: 'anthropic/claude-fable-5',
        hash: 'placeholder',
      };
    } catch (e: any) {
      this.logger.error(`Failed to parse JSON: ${e.message}`);
      throw new Error(`Failed to parse AI repair response: ${e.message} \nRaw: ${response.text}`);
    }
  }
}
