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
    const { sectionType, brandIdentity, sampleData } = input.context;

    if (!sectionType) {
      throw new Error('ComponentGeneratorSkill requires sectionType in context.');
    }

    const sampleDataStr = sampleData 
      ? `\nSAMPLE DATA PAYLOAD:\nThe component will receive exactly this JSON object in the \`data\` prop. You MUST build the component to map perfectly to this structure. Do NOT invent properties that aren't in this JSON:\n${JSON.stringify(sampleData, null, 2)}\n` 
      : '';

    const prompt = `
You are an expert React and Tailwind CSS developer.
Your task is to generate a beautiful, modern, and reusable Next.js React component for a section of type: "${sectionType}".
${sampleDataStr}
REQUIREMENTS:
1. The component MUST be named "${sectionType}".
2. It MUST be exported as default: \`export default function ${sectionType}({ data }: any) { ... }\`
3. It must accept a single \`data\` prop which contains all the text, copy, and image content. 
   - CRITICAL: Assume \`data\` EXACTLY matches the SAMPLE DATA PAYLOAD above. DO NOT invent props like \`data.headline\` or \`data.items\` unless they exist in the sample data. For example, if the sample data has \`data.sectionTitle\` and \`data.services\`, you MUST map over \`data.services\`, NOT \`data.items\`.
4. Use Tailwind CSS aggressively for styling. Make it look incredibly premium, responsive, modern, with hover states and transitions.
5. You can use Lucide React icons if needed (e.g., \`import { CheckCircle, ArrowRight } from 'lucide-react'\`).
6. Do NOT use any other external UI libraries. Use pure React + Tailwind.
7. Wrap the main return in a \`<section className="...">\` tag.
8. NEVER return markdown fences like \`\`\`tsx. Return EXACTLY and ONLY the raw source code.
9. IF generating a TestimonialsSection, you MUST render the testimonial quote using \`dangerouslySetInnerHTML\` to support HTML \`<strong>\` tags. You MUST display the rating accurately (e.g., 4.9 stars). Ensure the testimonial text is prominently displayed.
10. IF generating a Contact, Location, or FindUs section, you MUST NOT hardcode any dummy business data (e.g., fake addresses, phone numbers, or hours) into the visual layout. You MUST ONLY use the real business data passed through the \`data\` prop. If the layout includes a map, you MUST embed a working Google Maps iframe using the address from the data (e.g., \`<iframe src={\`https://maps.google.com/maps?q=\${encodeURIComponent(data.address || 'New York')}&t=&z=13&ie=UTF8&iwloc=&output=embed\`}>\`).
11. IF generating a HeaderSection, you MUST render a compact, top-fixed navigation bar containing a logo (or business name), a row of navigation links, and a primary CTA button. Do NOT render a large hero banner or massive headline. It MUST be a navigation bar (e.g. \`<nav>\`).
12. IF generating a FooterSection, you MUST render a classic bottom-of-page footer with columns for links, contact info, and copyright. Do NOT render a large hero banner or massive headline. It MUST be a footer (e.g. \`<footer>\`).
13. IF generating a ServiceDetailsSection, you MUST render the \`data.content\` string using \`dangerouslySetInnerHTML\`. This string contains rich HTML describing the service. Use Tailwind typography classes (e.g. \`prose prose-lg max-w-none\`) to style the HTML content beautifully. Ensure the layout is clean and readable (e.g., a reading-width column).
14. IF generating a LeadFormSection, you MUST render an actual HTML \`<form>\` based on the \`data.fields\` array. Include styled \`<input>\` and \`<textarea>\` elements, and a prominent submit button using \`data.submitText\`. Ensure the form looks professional and trustworthy.
15. IF generating a HeroSection, you MUST render a large, high-impact section suitable for the very top of the homepage. It should have a massive headline, primary and secondary CTAs, and a prominent background image or 2-column layout.
16. IF generating a PageHeaderSection, you MUST render a shorter, compact header suitable for inner pages. It MUST NOT be full screen. It should be a simple, elegant banner (e.g., centered text with a solid background color or a darkened background image overlay). Do NOT render a split 2-column layout. Do NOT render floating SaaS-like cards.
17. AESTHETICS RULE: DO NOT use SaaS-like grid backgrounds, glowing blurred orbs, or arbitrary indigo/fuchsia gradients. Maintain a professional, trustworthy contractor aesthetic. The design MUST align with the brand logo colors. You MUST ensure strict accessibility contrast. NEVER use floating badges that say "AI Powered" or similar tech buzzwords.
18. COLOR SYSTEM RULE: The site dynamically injects branding colors. You MUST use semantic Tailwind classes: \`bg-background\`, \`text-foreground\`, \`bg-primary\`, \`text-primary\`, \`bg-secondary\`, \`text-secondary\`, \`bg-accent\`, \`text-accent\`. DO NOT hardcode specific dark Tailwind colors like \`bg-neutral-950\` or \`text-neutral-300\`. If a section requires a dark aesthetic (e.g. Footer), use \`bg-secondary\` or \`bg-primary\` and ensure the text color class provides proper contrast (e.g., \`text-secondary-foreground\` or explicit contrasting color). You may use opacity modifiers like \`bg-primary/10\`.
19. CRITICAL CONTENT RULE: You MUST NOT hardcode any text, navigation links, or CTAs. You MUST NEVER use logical OR fallbacks for text or links (e.g., NEVER write \`data?.sectionTitle || 'Our Services'\`). You MUST dynamically render all text strictly from the \`data\` prop using exactly the properties provided. If the data is missing, render nothing.
20. NEXT.JS LINK RULE: You MUST use Next.js \`import Link from 'next/link'\` for all internal links instead of standard \`<a>\` tags.
21. NEXT.JS IMAGE RULE: You MUST use Next.js \`import Image from 'next/image'\` for all images. Assume the \`data\` object provides the image URL. You must provide a \`width\` and \`height\` prop to \`<Image>\`, or use \`fill\` with a relative parent container.

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
