import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { SectionSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class UIDesignerSkill implements Skill {
  readonly name = 'UIDesigner';
  private readonly logger = new Logger(UIDesignerSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brandIdentity, copyData, pageSlug } = input.context;

    if (!sectionType || !copyData) {
      throw new Error('UIDesignerSkill requires sectionType and copyData in context.');
    }

    const prompt = `
You are an expert UI/UX Designer and Frontend Engineer.
Your task is to take raw text data and map it perfectly into a JSON Abstract Syntax Tree (AST) using a specific library of primitive components.

CONTEXT:
Section Type: ${sectionType}
Brand Typography: ${brandIdentity?.typography?.headingFont || 'Inter'}
Page: ${pageSlug || 'Unknown'}

COPY DATA:
${JSON.stringify(copyData, null, 2)}

PRIMITIVES LIBRARY & CUSTOM COMPONENTS:
Instead of building the entire section from scratch using primitive boxes and text, you should output a single AST node that references a high-level React component (e.g., \`HeroSection\`, \`ContactForm\`, \`GalleryGrid\`).

You should invent a logical name for this custom component based on the \`Section Type\` (e.g., if Section Type is "hero", use "HeroSection").

1. The root element of your AST MUST be this custom component (e.g., \`"type": "HeroSection"\`).
2. You must pass a SINGLE prop called \`data\` to this component.
3. The \`data\` prop MUST be a JSON object containing ALL the copy data provided above. Map the copy data into logical fields (e.g., \`title\`, \`subtitle\`, \`items\`, \`images\`).

RULES:
1. You MUST generate a JSON AST.
2. Do NOT use primitive \`Box\` or \`Typography\` elements to build the layout. Simply output the custom component node with the \`data\` prop.
3. Incorporate ALL the text from the COPY DATA into the 'data' prop payload.
4. If images are needed, include them in the 'data' prop (use "UNSPLASH:query" pattern).
5. If the COPY DATA includes 'link' or 'href' fields for buttons or cards, you MUST map them into the 'data' prop so the components can be clicked.

OUTPUT FORMAT:
{
  "id": "generate-a-unique-string-id",
  "type": "${sectionType}",
  "ast": {
    "type": "YourCustomComponentName",
    "props": { 
      "data": {
        "title": "Mapped from copyData",
        "subtitle": "...",
        "items": [ ... ]
      }
    },
    "children": []
  }
}
    `;

    this.logger.log(`Designing AST for ${sectionType}...`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`UIDesigner LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    const validatedData = this.validator.validate(parsed, SectionSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
