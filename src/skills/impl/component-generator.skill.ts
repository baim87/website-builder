import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';

@Injectable()
export class ComponentGeneratorSkill implements Skill {
  readonly name = 'ComponentGenerator';
  private readonly logger = new Logger(ComponentGeneratorSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brandIdentity } = input.context;

    if (!sectionType) {
      throw new Error('ComponentGeneratorSkill requires sectionType in context.');
    }

    const prompt = `
You are an expert React and Tailwind CSS developer.
Your task is to generate a beautiful, modern, and reusable Next.js React component for a section of type: "${sectionType}".

REQUIREMENTS:
1. The component MUST be named "${sectionType}".
2. It MUST be exported as default: \`export default function ${sectionType}({ data }: any) { ... }\`
3. It must accept a single \`data\` prop which contains all the text, copy, and image content. 
   - Assume \`data\` will contain fields appropriate for this component (e.g., \`data.title\`, \`data.subtitle\`, \`data.items\` (array), \`data.images\`, \`data.ctaText\`, etc).
4. Use Tailwind CSS aggressively for styling. Make it look incredibly premium, responsive, modern, with hover states and transitions.
5. You can use Lucide React icons if needed (e.g., \`import { CheckCircle, ArrowRight } from 'lucide-react'\`).
6. Do NOT use any other external UI libraries. Use pure React + Tailwind.
7. Wrap the main return in a \`<section className="...">\` tag.
8. NEVER return markdown fences like \`\`\`tsx. Return EXACTLY and ONLY the raw source code.
9. IF generating a TestimonialsSection, you MUST render the testimonial text using \`dangerouslySetInnerHTML\` to support HTML \`<strong>\` tags. You MUST display the rating accurately (e.g., 4.9 stars) and include a Google logo icon SVG if the source is Google. Ensure the testimonial text is prominently displayed.

BRAND TYPOGRAPHY CONTEXT:
Heading Font: ${brandIdentity?.typography?.headingFont || 'Inter'}
Body Font: ${brandIdentity?.typography?.bodyFont || 'Inter'}

Return the raw code now.
`;

    this.logger.log(`Generating .tsx code for component: ${sectionType}`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY raw React .tsx code. No markdown formatting, no explanations.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 8192,
    });

    let code = response.text.trim();
    
    // Clean up markdown fences if the LLM hallucinated them
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
