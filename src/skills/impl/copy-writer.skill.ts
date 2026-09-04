import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { SectionDataSchemaRegistry } from '../schemas/section-data-contracts';

@Injectable()
export class CopyWriterSkill implements Skill {
  readonly name = 'CopyWriter';
  private readonly logger = new Logger(CopyWriterSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { sectionType, businessContext, brandVoice, seoMeta, pageSlug } = input.context;

    if (!sectionType || !businessContext) {
      throw new Error('CopyWriterSkill requires sectionType and businessContext in context');
    }

    const keywordsContext = seoMeta?.keywords ? `TARGET SEO KEYWORDS TO INCLUDE: ${seoMeta.keywords.join(', ')}` : '';
    
    let sectionSpecificRules = '';
    
    if (sectionType === 'AboutSection') {
      const ownerName = businessContext.contactPerson || 'The Owner';
      const bizName = businessContext.businessName || 'our company';
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Write the About Us section strictly in the first-person ("I"), from the perspective of the business owner (${ownerName}). Use a warm, highly personal, story-driven tone (e.g., "Hi! I'm ${ownerName}, the owner of ${bizName}. After years of experience..."). Focus on their personal expertise, passion, and dedication to delivering stress-free results for the customer.`;
    } else if (sectionType === 'WhyUsSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Highlight Unique Selling Propositions (USPs).`;
    } else if (sectionType === 'GallerySection') {
      let galleryRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY 4 or EXACTLY 8 images (a multiple of 4) to maintain a perfectly balanced bento grid layout. Generate a highly descriptive caption and use a relevant Unsplash placeholder URL (e.g., "UNSPLASH:luxury modern bathroom") for the "image" field for the services listed in the business context.`;
      if (pageSlug === 'portfolio') {
        galleryRules += `\n9. IMPORTANT PORTFOLIO RULE: Generate specific portfolio case studies.`;
      }
      sectionSpecificRules = galleryRules;
    } else if (sectionType === 'TimelineSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate a MAXIMUM of 4 process steps.`;
    } else if (sectionType === 'PageHeaderSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: This is for an inner page. Generate a shorter, punchy headline and a brief subtitle without a massive call to action like a primary Hero.`;
    } else if (sectionType === 'HeroSection') {
      let heroRules = `8. SECTION SPECIFIC RULES: Generate a strong, conversion-optimized hero headline. Include a primary Call to Action (CTA) using the "primaryCtaText" and "primaryCtaLink" fields. Also populate the new premium layout fields: eyebrow, trustMarks (e.g., ["Licensed & Insured", "On-Time Builds"]), reviewSnippet (e.g., {rating: 4.9, text: "rating from local homeowners"}), and floatingStat (e.g., {value: "320+", label: "Projects completed"}). For any avatars or stat images, use UNSPLASH queries.`;
      if (pageSlug === 'portfolio') {
        heroRules += `\n9. IMPORTANT PORTFOLIO RULE: Mention specific services like ${businessContext.services?.join(', ')}.`;
      } else if (pageSlug === 'service-areas') {
        heroRules += `\n9. IMPORTANT SERVICE AREAS RULE: You MUST explicitly mention the target service areas (from the business context) that have high search volume within the Hero copy.`;
      }
      sectionSpecificRules = heroRules;
    } else if (sectionType === 'BrandsSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate a list of realistic partner brands or certifications (e.g., HomeAdvisor, BBB, GAF, Trex). For their logos, generate realistic Unsplash placeholders like "UNSPLASH:company logo".`;
    } else if (sectionType === 'ServicesSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate copy for EVERY service listed in the business context 'services' array.`;
    } else if (sectionType === 'LocationsSection') {
      const validRoutesStr = input.context.validRoutes
        ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for links):\n${input.context.validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
        : '';
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate copy for EVERY service area listed in the business context 'serviceAreas' array. IMPORTANT: You MUST strictly use one of the provided valid routes for the 'link' field for each location (e.g., /service-areas/[city]/[service]). Do not invent or guess URLs. You MUST provide a highly relevant Unsplash placeholder URL (e.g., "UNSPLASH:suburban house" or "UNSPLASH:city skyline") for the "image" field for every location. Do NOT output raw city names for the image field.${validRoutesStr}`;
    } else if (sectionType === 'FaqSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate between 3 and 6 relevant Frequently Asked Questions in the "faqs" array.`;
    } else if (sectionType === 'HeaderSection') {
      const validRoutesStr = input.context.validRoutes
        ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for navLinks):\n${input.context.validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
        : '';
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: This is the primary top navigation bar. Do NOT generate a large headline or hero copy. You MUST output a "navLinks" array. For sub-pages like /services/[x] or /service-areas/[x], you MUST group them under a parent link (e.g. "Services") using the "subLinks" array. Use the "ctaText" and "ctaLink" fields for the primary contact button. NEVER use SaaS terminology. You MUST include a "logoUrl" field mapped to the logoUrl from the business context, and a "logoText" field for fallback.${validRoutesStr}`;
    } else if (sectionType === 'FooterSection') {
      const validRoutesStr = input.context.validRoutes
        ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for quickLinks):\n${input.context.validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
        : '';
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: This is the website footer. Do NOT generate massive headlines. You MUST output a "quickLinks" array representing footer links or columns. Include copyright text in the "copyright" field. You MUST include a "logoUrl" field mapped to the logoUrl from the business context.${validRoutesStr}`;
    } else if (sectionType === 'FindUsSection' || sectionType === 'ContactSection') {
      let mapRule = '';
      if (sectionType === 'FindUsSection') {
        mapRule = ` You MUST also generate a "mapUrl" field containing a valid Google Maps embed URL. If the businessContext contains GBP (Google Business Profile) data with a map URL, you MUST extract and use it. Otherwise, build an embed URL using the business address (e.g. https://maps.google.com/maps?q=[Address]&output=embed).`;
      }
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: Ensure the exact address, phone, email, and hours from the business context are included. 
      - IMPORTANT HOURS FORMATTING: Do NOT just copy and paste the raw hours array/string blindly. Intelligently format and consolidate the operating hours into a concise, human-readable format. Group days with identical hours (e.g., "Mon-Fri: 7:00 AM - 5:00 PM | Sat-Sun: Closed" or "Mon-Sun: 9:00 AM - 7:00 PM"). Use the actual hours provided in the businessContext, but make them clean and compact.${mapRule}`;
    } else if (sectionType === 'TestimonialsSection') {
      const contactName = businessContext.contactPerson || 'the owner';
      const bizName = businessContext.businessName || 'this company';
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY 9 highly realistic, detailed testimonials relevant to the target services. 
      - Ratings MUST be varied (e.g., 4.8, 4.9, 5.0).
      - The "quote" field MUST explicitly mention the contact person ("${contactName}") or the business name ("${bizName}") in a natural way.
      - You MUST wrap the most impactful phrases in the "quote" field with <strong> tags (e.g., "They were <strong>fast, affordable, and professional</strong>").
      - Make sure you include a "sectionTitle" field at the root level of the JSON.`;
    } else if (sectionType === 'LeadFormSection') {
      sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY the following form fields in the "fields" array: 
      - "First Name *" (type: text)
      - "Last Name *" (type: text)
      - "Phone *" (type: tel)
      - "Email *" (type: email)
      - "Address *" (type: text)
      - "City" (type: text, not required)
      - "Postal Code *" (type: text)
      - "Upload Photos Here" (type: file)
      - "Briefly Describe Your New Project" (type: textarea).
      Do NOT invent random fields. Use these exact labels. Set "required" to true if the label has a "*".`;
    }

    let locationMetricsStr = '';
    if (pageSlug === 'service-areas' && input.projectId) {
      const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
        where: { projectId: input.projectId }
      });
      if (locationMetrics.length > 0) {
        locationMetricsStr = `\nLOCATION KEYWORD METRICS:\n${JSON.stringify(locationMetrics, null, 2)}\nIMPORTANT: Use these highest volume keywords specifically for the location cards and hero copy!`;
      }
    }

    let locationServiceRules = '';
    
    let targetService = '';
    if (pageSlug.startsWith('services/') || input.context.isLocationServicePage) {
      const parts = pageSlug.split('/');
      const rawServiceSlug = parts.length === 2 ? parts[1] : parts[parts.length - 1];
      targetService = rawServiceSlug.replace(/-/g, ' ');
      
      locationServiceRules += `\nCRITICAL CONTEXT:\nThis page is STRICTLY dedicated to "${targetService}". ALL content generated for this section MUST exclusively talk about "${targetService}".`;
    }

    if (input.context.isLocationServicePage) {
      const citySlug = pageSlug.split('/')[1]; // service-areas/[city]/[service]
      const targetCity = citySlug.replace(/-/g, ' ');
      locationServiceRules += `\n\nFurthermore, this is a highly localized Service Area Detail page. You must explicitly mention BOTH the specific Service ("${targetService}") and the specific City ("${targetCity}") throughout the copy to maximize local SEO relevance.`;
    }

    const schema = (SectionDataSchemaRegistry as any)[sectionType];
    let bareJsonSchema: any = undefined;
    if (schema) {
      const fullJsonSchema = zodToJsonSchema(schema, sectionType);
      bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[sectionType] : fullJsonSchema;
      // Strip $schema if present
      if (bareJsonSchema.$schema) {
        delete bareJsonSchema.$schema;
      }
    }

    const prompt = `You are an expert full-stack developer, copywriter, and UI designer for a contractor website.
Write the UI AST and copy for a "${sectionType}".

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND VOICE:
${JSON.stringify(brandVoice || {}, null, 2)}

${keywordsContext}
${locationMetricsStr}
${locationServiceRules}

RULES:
1. You MUST generate the exact text required for the section.
2. For images, generate an Unsplash query string formatted as "UNSPLASH:query". Do not use URLs for images, only UNSPLASH: queries.
3. Write compelling, high-converting copy that matches the brand voice.
4. Output a single JSON object containing all text and data, strictly following the provided schema.
5. Provide a flexible structure that a UI Designer can easily map into a layout.
6. IMPORTANT: If a section includes buttons, cards, or actionable items, you MUST include a relative URL path (e.g., '/services', '/contact', '/portfolio') in a 'link' or 'href' field.
7. CRITICAL CTA RULE: NEVER use SaaS terminology like "Watch Demo", "Start for Free", or "Free Trial". This is a local service contractor website. All CTAs MUST be lead generation focused (e.g., "Get a Quote", "Request an Estimate", "Call Now", "Book a Consultation").
${sectionSpecificRules}
      `;

    this.logger.log(`Generating copy for ${sectionType}...`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You are an expert copywriter. Output strictly matching the requested JSON schema via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: sectionType,
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      if (!raw) {
         this.logger.warn(`[CopyWriter] Raw text was empty! Fallback parsing will result in empty object.`);
      } else {
         // this.logger.debug(`[CopyWriter] Raw LLM output: ${raw.substring(0, 500)}...`);
      }
      
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{') && raw.includes('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw || '{}');
    } catch (e) {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`CopyWriter LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    let validatedData = parsed;
    if (schema) {
      validatedData = schema.parse(parsed);
    }

    // Business data grounding validation (e.g., prevent fake placeholders)
    this.validator.groundCheckContent(validatedData, businessContext);

    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
