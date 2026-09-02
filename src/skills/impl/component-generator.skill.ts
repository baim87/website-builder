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
10. IF generating a Contact, Location, or FindUs section, you MUST NOT hardcode any dummy business data (e.g., fake addresses, phone numbers, or hours) into the visual layout. You MUST ONLY use the real business data passed through the \`data\` prop. Do NOT duplicate or repeat the display of the contact information (e.g., do not hardcode a sidebar and then loop over \`data.items\` below it). Integrate the real \`data\` directly into the primary layout. If the layout includes a map, you MUST embed a working Google Maps iframe using the address from the data (e.g., \`<iframe src={\`https://maps.google.com/maps?q=\${encodeURIComponent(data.address || data.items?.find(i => i.title.toLowerCase().includes('location') || i.title.toLowerCase().includes('address'))?.description || 'New York')}&t=&z=13&ie=UTF8&iwloc=&output=embed\`}>\`).
11. IF generating a HeaderSection, you MUST render a compact, top-fixed navigation bar containing a logo (or business name), a row of navigation links, and a primary CTA button. Do NOT render a large hero banner or massive headline. It MUST be a navigation bar (e.g. \`<nav>\`).
12. IF generating a FooterSection, you MUST render a classic bottom-of-page footer with columns for links, contact info, and copyright. Do NOT render a large hero banner or massive headline. It MUST be a footer (e.g. \`<footer>\`).
13. AESTHETICS RULE: DO NOT use a dark mode, dark theme, or SaaS-like grid backgrounds unless specifically requested in the brand identity. Use clean, bright, professional contractor aesthetics (e.g., white, slate, or light gray backgrounds, high contrast text, and clear professional layouts).

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
