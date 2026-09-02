import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { CopyDataSchema } from '../schemas/skill-outputs.schema';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

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
      sectionSpecificRules = `5. IMPORTANT: Write the About Us section strictly in the first-person ("I"), from the perspective of the business owner (${ownerName}). Use a warm, highly personal, story-driven tone (e.g., "Hi! I'm ${ownerName}, the owner of ${bizName}. After years of experience..."). Focus on their personal expertise, passion, and dedication to delivering stress-free results for the customer.`;
    } else if (sectionType === 'WhyUsSection') {
      sectionSpecificRules = `5. IMPORTANT: Highlight Unique Selling Propositions (USPs).`;
    } else if (sectionType === 'GallerySection') {
      let galleryRules = `5. IMPORTANT: Provide a highly descriptive 'alt' tag, and use a relevant Unsplash placeholder URL (e.g., "UNSPLASH:luxury modern bathroom") for EVERY service listed in the business context 'services' array.`;
      if (pageSlug === 'portfolio') {
        galleryRules += `\n6. IMPORTANT PORTFOLIO RULE: Generate specific portfolio case studies.`;
      }
      sectionSpecificRules = galleryRules;
    } else if (sectionType === 'TimelineSection') {
      sectionSpecificRules = `5. IMPORTANT: Generate a MAXIMUM of 4 process steps.`;
    } else if (sectionType === 'PageHeaderSection') {
      sectionSpecificRules = `5. IMPORTANT: This is for an inner page. Generate a shorter, punchy headline and a brief subtitle without a massive call to action like a primary Hero.`;
    } else if (sectionType === 'HeroSection') {
      let heroRules = `5. IMPORTANT: Generate a strong, conversion-optimized hero headline. Include a primary Call to Action (CTA).`;
      if (pageSlug === 'portfolio') {
        heroRules += `\n6. IMPORTANT PORTFOLIO RULE: Mention specific services like ${businessContext.services?.join(', ')}.`;
      } else if (pageSlug === 'service-areas') {
        heroRules += `\n6. IMPORTANT SERVICE AREAS RULE: You MUST explicitly mention the target service areas (from the business context) that have high search volume within the Hero copy.`;
      }
      sectionSpecificRules = heroRules;
    } else if (sectionType === 'ServicesSection') {
      sectionSpecificRules = `5. IMPORTANT: Generate copy for EVERY service listed in the business context 'services' array.`;
    } else if (sectionType === 'LocationsSection') {
      sectionSpecificRules = `5. IMPORTANT: Generate copy for EVERY service area listed in the business context 'serviceAreas' array.`;
    } else if (sectionType === 'FaqSection') {
      sectionSpecificRules = `5. IMPORTANT: You MUST generate between 3 and 6 relevant Frequently Asked Questions.`;
    } else if (sectionType === 'HeaderSection') {
      sectionSpecificRules = `5. IMPORTANT: This is the primary top navigation bar. Do NOT generate a large headline, subheadline, or hero copy. Only generate a JSON object representing navigation links (e.g., Home, About, Services, Portfolio, Contact) and a single primary contact CTA button.`;
    } else if (sectionType === 'FooterSection') {
      sectionSpecificRules = `5. IMPORTANT: This is the website footer. Only generate a JSON object representing footer columns (e.g., Quick Links, Contact Info, Services) and copyright text. Do NOT generate massive headlines or hero copy.`;
    } else if (sectionType === 'FindUsSection') {
      sectionSpecificRules = `5. IMPORTANT: Ensure the exact address, phone, email, and hours from the business context are included perfectly.`;
    } else if (sectionType === 'TestimonialsSection') {
      const contactName = businessContext.contactPerson || 'the owner';
      const bizName = businessContext.businessName || 'this company';
      sectionSpecificRules = `5. IMPORTANT: Generate between 6 and 9 highly realistic, detailed testimonials relevant to the target services. 
      - Ratings MUST be varied (e.g., 4.8, 4.9, 5.0).
      - The testimonial text MUST explicitly mention the contact person ("${contactName}") or the business name ("${bizName}") in a natural way.
      - You MUST wrap the most impactful phrases in the testimonial text with <strong> tags (e.g., "They were <strong>fast, affordable, and professional</strong>").
      - Each testimonial must include the source of the review, which MUST be "Google".`;
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
      const citySlug = pageSlug.split('/')[0];
      const targetCity = citySlug.replace(/-/g, ' ');
      locationServiceRules += `\n\nFurthermore, this is a highly localized Service Area Detail page. You must explicitly mention BOTH the specific Service ("${targetService}") and the specific City ("${targetCity}") throughout the copy to maximize local SEO relevance.`;
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
2. For images, generate an Unsplash query string formatted as "UNSPLASH:query".
3. Write compelling, high-converting copy that matches the brand voice.
4. Output a single JSON object (key-value map) containing all headlines, subheadlines, paragraphs, lists, and image queries.
5. Provide a flexible structure that a UI Designer can easily map into a layout.
6. IMPORTANT: If a section includes buttons, cards, or actionable items, you MUST include a relative URL path (e.g., '/services', '/contact', '/portfolio') in a 'link' or 'href' field.
7. CRITICAL CTA RULE: NEVER use SaaS terminology like "Watch Demo", "Start for Free", or "Free Trial". This is a local service contractor website. All CTAs MUST be lead generation focused (e.g., "Get a Quote", "Request an Estimate", "Call Now", "Book a Consultation").
${sectionSpecificRules}

OUTPUT FORMAT:
Return a JSON object matching this general structure, adapted for the specific section Type:
{
  "badge": "Top Rated in Sydney",
  "headline": "Your Main Headline Here",
  "subheadline": "Your secondary text here.",
  "items": [
    {
      "title": "Item 1",
      "description": "Description 1",
      "imageQuery": "UNSPLASH:modern kitchen",
      "icon": "Award"
    }
  ],
  "callToAction": {
    "text": "Get a Quote",
    "href": "/contact"
  }
}
      `;

    this.logger.log(`Generating copy for ${sectionType}...`);

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
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
      throw new Error(`CopyWriter LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    const validatedData = this.validator.validate(parsed, CopyDataSchema);
    
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
