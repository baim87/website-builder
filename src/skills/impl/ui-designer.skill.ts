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

PRIMITIVES LIBRARY (Use these exactly as named to build the AST):
- Section: ALWAYS use this as the root wrapper for a section! Props: id, className (bg colors). Automatically constrains max-width and adds vertical padding.
- Card: A beautifully styled white container with hover shadows. Use for grid items, testimonials, and services. Props: className
- Accordion: A clickable dropdown for FAQs. Props: title (string), className. Its children will be revealed when clicked.
- Carousel: A swipeable slider. Use to wrap multiple Cards for testimonials or galleries. Props: className
- Badge: A small pill-shaped accent tag. Ideal for "Top Rated" above a hero title. Props: className
- Box: A standard container (div). Props: className (Tailwind CSS)
- Typography: For all text. Props: variant ("h1", "h2", "h3", "p", "span"), className
- Button: Clickable CTA. Props: href, variant ("primary", "secondary", "outline", "ghost"), className
- Image: An image. Props: src (use "UNSPLASH:query" pattern), alt, className
- Grid: A CSS grid wrapper. Props: columns (number), gap (number), className
- Icon: A Lucide icon. Props: name (e.g. "ShieldCheck"), className

DESIGN PATTERN INSPIRATIONS:
1. Floating Widgets: You can use <Box> with Tailwind absolute positioning (e.g. "absolute -bottom-10 right-5 shadow-2xl p-6 rounded-2xl bg-white/90 backdrop-blur") over an image to create premium, layered looks.
2. Bento Grids: Use <Grid> with specific Tailwind row/col spanning on children (e.g., "col-span-2 row-span-2") to create visually striking asymmetrical layouts.
3. Overlapping Elements: Use negative margins (e.g. "-mt-20") or absolute positioning to break elements out of their standard flow.

RULES:
1. You MUST generate a JSON AST matching the SectionSchema.
2. The root element of your AST MUST ALWAYS BE A "Section" PRIMITIVE.
3. Integrate ALL the text from the COPY DATA into the layout using Typography primitives.
4. Apply Tailwind CSS classes aggressively in the "className" props to build beautiful, modern layouts (flexbox, grids, gradients, paddings, glassmorphism).

OUTPUT FORMAT:
{
  "id": "generate-a-unique-string-id",
  "type": "${sectionType}",
  "ast": {
    "type": "Section",
    "props": { "className": "bg-white relative overflow-hidden" },
    "children": [
       // Map the copyData here using primitives
    ]
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
