import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';
import { getThemeById } from '../constants/theme-definitions.constant';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

@Injectable()
export class ComponentGeneratorSkill implements Skill {
  readonly name = AISkill.COMPONENT_GENERATOR;
  private readonly logger = new Logger(ComponentGeneratorSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
  ) { }

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, brandIdentity, sampleData, themePreference, designTokens } = input.context;

    if (!sectionType) {
      throw new Error('ComponentGeneratorSkill requires sectionType in context.');
    }

    const theme = themePreference ? getThemeById(themePreference) : undefined;
    let themeHints = '';

    if (designTokens && designTokens.colors) {
      themeHints += `\nBRAND DESIGN TOKENS:\n`;
      themeHints += `COLORS (HEX — for aesthetic reference only, DO NOT hardcode in Tailwind classes):\n`;
      themeHints += `- Primary: ${designTokens.colors.primary}\n`;
      themeHints += `- Secondary: ${designTokens.colors.secondary}\n`;
      themeHints += `- Accent: ${designTokens.colors.accent}\n`;
      themeHints += `- Background: ${designTokens.colors.background}\n`;
      themeHints += `- Surface Dark: ${designTokens.colors.surfaceDark}\n`;
    }

    if (designTokens && designTokens.typography) {
      themeHints += `\nTYPOGRAPHY:\n`;
      themeHints += `- Heading Font: ${designTokens.typography.headingFont || 'Inter'}\n`;
      themeHints += `- Body Font: ${designTokens.typography.bodyFont || 'Inter'}\n`;
      if (designTokens.typography.baseFontSize) themeHints += `- Base Font Size: ${designTokens.typography.baseFontSize}\n`;
      if (designTokens.typography.headingWeight) themeHints += `- Heading Weight: ${designTokens.typography.headingWeight}\n`;
    }

    if (designTokens && designTokens.spacing) {
      themeHints += `\nSPACING:\n`;
      if (designTokens.spacing.sectionPadding) themeHints += `- Section Padding: ${designTokens.spacing.sectionPadding}\n`;
      if (designTokens.spacing.containerMaxWidth) themeHints += `- Container Max Width: ${designTokens.spacing.containerMaxWidth}\n`;
    }

    if (designTokens && designTokens.borderRadius) {
      themeHints += `\nBORDER RADIUS:\n`;
      if (designTokens.borderRadius.default) themeHints += `- Default: ${designTokens.borderRadius.default}\n`;
      if (designTokens.borderRadius.button) themeHints += `- Button: ${designTokens.borderRadius.button}\n`;
      if (designTokens.borderRadius.card) themeHints += `- Card: ${designTokens.borderRadius.card}\n`;
    }

    if (designTokens && designTokens.shadows) {
      themeHints += `\nSHADOWS:\n`;
      if (designTokens.shadows.card) themeHints += `- Card Shadow: ${designTokens.shadows.card}\n`;
      if (designTokens.shadows.button) themeHints += `- Button Shadow: ${designTokens.shadows.button}\n`;
    }

    themeHints += '\n';

    if (theme && theme.componentStyleRules && !theme.componentStyleRules.includes('TODO')) {
      themeHints += `THEME INSTRUCTION: You MUST design this component using '${theme.label}' principles.\n`;
      themeHints += `Design System Hints: ${theme.designSystemHints}\n`;
      themeHints += `Component Rules: ${theme.componentStyleRules}\n`;
      themeHints += `Global CSS Hints: ${theme.globalCssHints}\n`;
      themeHints += `Typography Rules: Headings: ${theme.typographyHints?.headingStyle} | Body: ${theme.typographyHints?.bodyStyle}\n`;
    }

    const schema = (SectionDataSchemaRegistry as any)[sectionType];
    let jsonSchemaStr = '';
    if (schema) {
      const fullJsonSchema = zodToJsonSchema(schema, sectionType);
      const bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[sectionType] : fullJsonSchema;
      if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;
      jsonSchemaStr = `\nDATA PROP JSON SCHEMA (STRICT CONTRACT):\nThe component's \`data\` prop will ALWAYS follow this exact JSON Schema. You MUST use these EXACT property names. Do NOT rename, restructure, or alias any field.\n${JSON.stringify(bareJsonSchema, null, 2)}\n`;
    }

    const sampleDataStr = sampleData
      ? `\nSAMPLE DATA (for reference only — DO NOT deviate from the schema above):\n${JSON.stringify(sampleData, null, 2)}\n`
      : '';

    const prompt = `
You are an expert React and Tailwind CSS developer.
Your task is to generate a beautiful, modern, and reusable Next.js React component for a section of type: "${sectionType}".
${jsonSchemaStr}
${sampleDataStr}${themeHints}
REQUIREMENTS:
1. The component MUST be named "${sectionType}".
2. It MUST be exported as default: \`export default function ${sectionType}({ data }: any) { ... }\`
3. It must accept a single \`data\` prop which contains all the text, copy, and image content. 
   - CRITICAL: Assume \`data\` EXACTLY matches the JSON Schema contract above. DO NOT invent props like \`data.headline\` or \`data.items\` unless they exist in the schema. For example, if the schema specifies \`data.sectionTitle\` and \`data.services\`, you MUST map over \`data.services\`, NOT \`data.items\`.
4. Use Tailwind CSS aggressively for styling. Make it look incredibly premium, responsive, modern, with hover states and transitions. TYPOGRAPHY RULE: You MUST use the \`text-balance\` class on all major headlines (e.g., \`h1\`, \`h2\`, \`h3\`) to prevent orphaned words on new lines, and use \`text-pretty\` on long paragraphs.
5. You can use Lucide React icons for general UI elements (e.g., \`import { CheckCircle, ArrowRight } from 'lucide-react'\`). CRITICAL: For social media or brand icons (like Facebook, Google, Yelp, Instagram), you MUST use \`react-icons/fa\` (e.g., \`import { FaFacebook, FaGoogle, FaYelp, FaGlobe } from 'react-icons/fa'\`). Do NOT generate raw inline SVGs for brand icons. If a platform is unrecognized, fallback to \`FaGlobe\`.
6. Do NOT use any other external UI libraries. Use pure React + Tailwind.
7. Wrap the main return in a \`<section className="...">\` tag.
8. CLIENT COMPONENT RULE: If the component uses ANY React hooks (useState, useEffect, useRef, useCallback, useMemo), you MUST add \`"use client";\` as the VERY FIRST line of the file, BEFORE any imports. This is required by the Next.js App Router. Components without hooks should NOT have "use client".
9. NEVER return markdown fences like \`\`\`tsx. Return EXACTLY and ONLY the raw source code.
10. IF generating a TestimonialsSection, you MUST render the testimonial quote using \`dangerouslySetInnerHTML\` to support HTML \`<strong>\` tags. You MUST display the rating accurately (e.g., 4.9 stars). Ensure the testimonial text is prominently displayed.
11. IF generating a Contact, Location, or FindUs section, you MUST NOT hardcode dummy data. Render the map using an iframe. CRITICAL: For the iframe src, you MUST use a generic maps embed URL format like: \`src={\`https://maps.google.com/maps?q=\${encodeURIComponent(data.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed\`}\`. DO NOT use \`data.mapUrl\` directly in the iframe src because standard map URLs are blocked from being embedded by X-Frame-Options.
12. IF generating a HeaderSection, you MUST render a compact, top-fixed navigation bar containing a logo (or business name), a row of navigation links, and a primary CTA button. Do NOT render a large hero banner or massive headline. It MUST be a navigation bar (e.g. \`<nav>\`). CRITICAL: If \`data.phone\` is provided, you MUST render it visibly inline as a prominent text link (e.g. \`<a href={"tel:" + data.phone}>\`) within the desktop navigation bar alongside the CTA button. Do NOT hide the phone number in a dropdown.
13. IF generating a FooterSection, you MUST render a classic bottom-of-page footer with columns for links, contact info, and copyright. Do NOT render a large hero banner or massive headline. It MUST be a footer (e.g. \`<footer>\`). If 'serviceLinks' exists, you MUST render it as a separate column (e.g., "Services") alongside the "quickLinks" column (e.g., "Navigate" or "Quick Links"). If 'developerCredit' and 'developerLink' exist, you MUST render them as a subtle link (e.g., \`<a href={data.developerLink} target="_blank" rel="noopener noreferrer">\`) next to or below the copyright text.
14. IF generating a ServiceDetailsSection, you MUST render the \`data.content\` string using \`dangerouslySetInnerHTML\`. This string contains rich HTML describing the service. Use Tailwind typography classes (e.g. \`prose prose-lg max-w-none\`) to style the HTML content beautifully. Ensure the layout is clean and readable (e.g., a reading-width column).
15. IF generating a LeadFormSection, you MUST render an actual HTML \`<form>\` based on the \`data.fields\` array. Include styled \`<input>\` and \`<textarea>\` elements, and a prominent submit button using \`data.submitText\`. Ensure the form looks professional and trustworthy. IMPORTANT: You MUST implement a \`submitted\` state. When \`submitted\` is true, hide the form and display a clear, well-styled success message with a checkmark icon and text (e.g., "Request Received! Our team will reach out shortly.") so the user knows it succeeded.
16. IF generating a HeroSection, you MUST render a large, high-impact section suitable for the very top of the homepage. 
    - Follow the THEME INSTRUCTION closely for the visual layout structure (e.g., asymmetrical, centered, bento-box, full-bleed, etc.). Be creative!
    - If 'data.eyebrow' exists, render it small above the headline.
    - If 'data.reviewSnippet' exists, render it near the CTAs with a row of overlapping avatar images and star icons.
    - If 'data.trustMarks' exists, render them visually near the CTAs.
    - If 'data.floatingStat' exists, render it prominently (e.g. a glassmorphism card or floating element).
16. IF generating a PageHeaderSection, you MUST render a shorter, compact header suitable for inner pages. It MUST NOT be full screen. It should be a simple, elegant banner (e.g., centered text with a solid background color or a darkened background image overlay). Do NOT render a split 2-column layout. Do NOT render floating SaaS-like cards. If 'primaryCtaText' or 'secondaryCtaText' exist in the data, render them as a pair of elegant action buttons below the subtitle.
17. IF generating a BrandsSection, you MUST render the logos cleanly. Use CSS filters (e.g., 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all') to make the logos look uniform and professional.
18. IF generating an AnnouncementBarSection, you MUST create a \\"use client\\" component that fetches \`/seasonality.json\` on mount using \`useEffect\`.
    - If the current month (1-12) matches one of the \`peakMonths\` in the JSON, display the \`announcementBar.message\` and a link to \`announcementBar.ctaLink\`.
    - It MUST be a thin, dismissible bar fixed at the very top of the screen (above the header) or rendered inline at the top.
    - Use a high-contrast color (like \`bg-accent text-accent-foreground\` or \`bg-primary text-primary-foreground\`).
    - If it's not a peak month, or the fetch fails, return \`null\` (render nothing) or use \`data.defaultMessage\` if available.
19. IF generating a GallerySection or bento-box grid, you MUST mathematically balance the CSS Grid classes so the layout doesn't look broken. If using row-span and col-span, ensure the interlocking pattern resolves cleanly at the bottom without awkward gaps or lone vertically stretched images. For 4 or 8 items, create a perfectly symmetric or repeating block pattern.
20. AESTHETICS RULE: DO NOT use SaaS-like grid backgrounds, glowing blurred orbs, or arbitrary indigo/fuchsia gradients. Maintain a professional, trustworthy contractor aesthetic. The design MUST align with the brand logo colors. You MUST ensure strict accessibility contrast. NEVER use floating badges that say "AI Powered" or similar tech buzzwords.
21. COLOR SYSTEM RULE: The site dynamically injects branding colors. You MUST use semantic Tailwind classes: \`bg-background\`, \`text-foreground\`, \`bg-primary\`, \`text-primary\`, \`bg-secondary\`, \`text-secondary\`, \`bg-accent\`, \`text-accent\`, \`bg-surface-dark\`, \`text-surface-dark-foreground\`. DO NOT hardcode specific dark Tailwind colors like \`bg-neutral-950\` or \`text-neutral-300\`. If a section requires a dark aesthetic (e.g. Footer, Hero overlay), you MUST use \`bg-surface-dark\` and \`text-surface-dark-foreground\`. IMPORTANT: I have provided the BRAND COLORS (HEX) above. You MUST use these hex codes purely to understand the aesthetic vibe (e.g. to know if 'primary' is a dark blue vs a light gold) to make smart design choices about contrast, overlays, and color combinations. But NEVER output these hex codes in your Tailwind classes.
22. UNIQUENESS & CREATIVITY RULE: You MUST generate a completely fresh, creative, and unique layout for this component. Do NOT rely on standard, boring templates. Vary your structural choices (e.g. asymmetrical grids, overlapping elements, bento boxes, split screens, etc.) to ensure this brand gets a distinct identity.
23. CRITICAL CONTENT RULE: You MUST NOT hardcode any text, navigation links, or CTAs. You MUST NEVER use logical OR fallbacks for text or links (e.g., NEVER write \`data?.sectionTitle || 'Our Services'\`). You MUST dynamically render all text strictly from the \`data\` prop using exactly the properties provided. If the data is missing, render nothing.
24. NEXT.JS LINK RULE: You MUST use Next.js \`import Link from 'next/link'\` for all internal links instead of standard \`<a>\` tags.
25. NEXT.JS IMAGE RULE: You MUST use Next.js \`import Image from 'next/image'\` for all images. Image props in \`data\` (like \`data.image\`, \`data.backgroundImage\`, \`item.image\`, etc.) might be passed as simple strings OR as objects with \`{ src, alt }\` properties. You MUST handle BOTH cases gracefully wherever you render an image (e.g., \`src={typeof data.image === 'string' ? data.image : data.image?.src}\`). You must provide a \`width\` and \`height\` prop to \`<Image>\`, or use \`fill\` with a relative parent container.
26. OBJECT RENDERING RULE: You MUST NEVER render a nested object or array directly as a React child (e.g., NEVER write \`<div>{data.hours}</div>\` or \`<span>{item}</span>\` when \`item\` could be an object). If a property in the sample data is an object (like \`{ label: "...", items: [...] }\`), you MUST destructure it and render its primitive properties individually. If a property is an array, you MUST \`.map()\` over it and render each element's primitive fields. Rendering an object directly will crash Next.js at build time. When in doubt, always use \`typeof val === 'string' ? val : JSON.stringify(val)\` as a safety net.
27. DEFENSIVE DATA ACCESS RULE: Always use optional chaining (\`?.\`) when accessing nested data properties and guard \`.map()\` calls with \`Array.isArray()\` checks (e.g., \`{Array.isArray(data.items) && data.items.map(...)}\`). Data may be missing or shaped differently than expected.
28. LOGO RENDERING RULE (Header & Footer): IF generating a HeaderSection or FooterSection, you MUST render the \`data.logoUrl\` as a standard HTML \`<img>\` tag (NOT Next.js \`<Image>\`) to naturally preserve unknown aspect ratios. Give it a responsive class like \`className="h-7 w-auto object-contain lg:h-8"\` (for Header) or \`h-8 lg:h-10\` (for Footer). IMPORTANT: If a logo exists, you MUST hide the business name text (\`data.logoText\` or \`data.companyName\`) to prevent displaying both the logo image and the text name side-by-side. E.g., \`{!logoSrc && data?.logoText && (<span>{data.logoText}</span>)}\`.
29. FILE UPLOAD RULE: IF generating a LeadFormSection, you MUST construct the form submission using \`FormData\`. Do NOT use \`JSON.stringify\`. If a field has \`type="file"\`, you MUST render an \`<input type="file" multiple accept="image/*" />\` and properly append the selected file blobs to the \`FormData\` object in the submit handler. Submit the \`FormData\` via \`fetch('/api/lead', { method: 'POST', body: formData })\`. Do NOT set the \`Content-Type\` header manually; let the browser set it with the multipart boundary.
30. MOBILE RESPONSIVENESS RULE: You MUST ensure all components look perfect on mobile screens. Specifically for typography and drop caps: NEVER use un-prefixed \`first-letter:\` modifiers (like \`prose-p:first-letter:text-[64px]\`) because large drop caps break mobile layouts. If you use drop caps, you MUST use a responsive breakpoint (e.g. \`sm:prose-p:first-letter:\`). When in doubt, avoid drop caps entirely.

BRAND TYPOGRAPHY CONTEXT:
Heading Font: ${brandIdentity?.typography?.headingFont || designTokens?.typography?.headingFont || 'Inter'}
Body Font: ${brandIdentity?.typography?.bodyFont || designTokens?.typography?.bodyFont || 'Inter'}

Return the raw code now.
`;

    this.logger.log(`Generating .tsx code for component: ${sectionType}`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
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

    // Auto-inject "use client" if the component uses React hooks but forgot the directive
    const usesHooks = /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useContext)\b/.test(code);
    if (usesHooks && !code.includes('"use client"') && !code.includes("'use client'")) {
      this.logger.warn(`Component ${sectionType} uses React hooks but missing "use client" — auto-injecting.`);
      code = '"use client";\n' + code;
    }

    // Auto-strip non-existent lucide-react brand icons (Facebook, Instagram, Twitter, etc.)
    const invalidIcons = ['Facebook', 'Instagram', 'Twitter', 'Linkedin', 'Youtube', 'Tiktok', 'Pinterest', 'Snapchat', 'Github', 'Dribbble', 'Behance'];
    code = code.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
      (_match, imports) => {
        const cleaned = imports
          .split(',')
          .map((i: string) => i.trim())
          .filter((i: string) => !invalidIcons.includes(i) && i.length > 0);
        if (cleaned.length === 0) return '// lucide-react import removed (invalid icons)';
        return `import { ${cleaned.join(', ')} } from 'lucide-react'`;
      }
    );

    // Ensure first-letter modifiers are responsive (sm: breakpoint minimum)
    // Restricted to className attributes to avoid breaking text nodes or other properties
    code = code.replace(/className=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g, (match, doubleQ, singleQ, braces) => {
      const classContent = doubleQ ?? singleQ ?? braces ?? "";
      const wrapperStart = match.startsWith('className={') ? '{' : match.startsWith("className='") ? "'" : '"';
      const wrapperEnd = match.startsWith('className={') ? '}' : match.startsWith("className='") ? "'" : '"';

      const replacedContent = classContent.replace(/(?<![smxl234]:)\b([a-z0-9-]+:)?first-letter:[^\s"'`]+/g, (innerMatch: string) => {
        if (innerMatch.match(/^(sm|md|lg|xl|2xl):/)) {
          return innerMatch;
        }
        return `sm:${innerMatch}`;
      });

      return `className=${wrapperStart}${replacedContent}${wrapperEnd}`;
    });

    const hash = crypto.createHash('sha256').update(code).digest('hex');

    return {
      data: { code },
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
