import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PageStructureSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class PageStructureSkill implements Skill {
  readonly name = 'PageStructure';
  private readonly logger = new Logger(PageStructureSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const pageSlug = input.context.pageSlug || 'home';

    // HARDCODED PAGE STRUCTURES (User Dictated)
    const userDictatedStructures: Record<string, string[]> = {
      'home': [
        'HeroSection', 'AboutSection', 'ServicesSection', 'WhyUsSection', 
        'GallerySection', 'TimelineSection', 'TestimonialsSection', 'CallToActionSection'
      ],
      'about-us': [
        'HeroSection', 'AboutSection', 'WhyUsSection', 'LocationsSection', 
        'TestimonialsSection', 'CallToActionSection'
      ],
      'portfolio': [
        'HeroSection', 'GallerySection'
      ],
      'services': [
        'HeroSection', 'ServicesSection'
      ],
      'service-areas': [
        'HeroSection', 'LocationsSection', 'TestimonialsSection', 'CallToActionSection'
      ],
      'contact': [
        'HeroSection', 'LeadFormSection', 'FindUsSection'
      ]
    };

    if (userDictatedStructures[pageSlug]) {
      this.logger.log(`[${pageSlug}] Using hardcoded user-dictated page structure.`);
      const validatedData = this.validator.validate({ sections: userDictatedStructures[pageSlug] }, PageStructureSchema);
      const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
      return { data: validatedData, hash, model: 'hardcoded' };
    }

    if (input.context.isLocationServicePage || pageSlug.startsWith('services/') || pageSlug.startsWith('service-areas/')) {
      this.logger.log(`[${pageSlug}] Using hardcoded dynamic detail page structure.`);
      const detailStructure = ['PageHeaderSection', 'ServiceDetailsSection', 'GallerySection', 'BeforeAfterSection', 'TestimonialsSection', 'FaqSection', 'CallToActionSection'];
      const validatedData = this.validator.validate({ sections: detailStructure }, PageStructureSchema);
      const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
      return { data: validatedData, hash, model: 'hardcoded' };
    }
    
    const prompt = `Determine the layout for the "${pageSlug}" page of this contractor business.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "sections": ["HeroSection", "ServicesSection", "AboutSection"]
}

SUPPORTED SECTION TYPES (You can ONLY pick from these):
- HeroSection: Used for top-of-page introductions on the home page.
- PageHeaderSection: Used for the smaller hero section at the top of detail pages (like service or location details).
- BrandsSection: Used to display trust badges, certifications, or partner logos.
- ServicesSection: Used to list services offered.
- AboutSection: Used for company history and team presentation.
- WhyUsSection: Used for value propositions and differentiators.
- BeforeAfterSection: Used to showcase project transformations.
- TimelineSection: Used to explain the process step-by-step.
- TestimonialsSection: Used for social proof and client reviews.
- LocationsSection: Used to list service areas.
- ServiceDetailsSection: Used for the detailed content body of a specific service.
- CallToActionSection: Used for the large bottom CTA block commonly found on pages.

Do not invent new section types. Just output the array of strings wrapped in the JSON object.`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    this.logger.debug(`[${pageSlug}] PageStructure output: ${response.text}`);

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
      throw new Error(`PageStructure LLM returned unparseable output`);
    }

    const validatedData = this.validator.validate(parsed, PageStructureSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
