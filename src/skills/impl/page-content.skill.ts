import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PageContentSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class PageContentSkill implements Skill {
  readonly name = 'PageContent';
  private readonly logger = new Logger(PageContentSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const pageSlug = input.context.pageSlug || 'home';
    const prompt = `Generate content for the ${pageSlug} page of this contractor business.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "slug": "${pageSlug}",
  "sections": [
    {
      "id": "unique-section-id",
      "type": "HeroSection", // MUST be one of the supported types below
      "content": { ... } // Must match the data structure expected by the section
    }
  ]
}

SUPPORTED SECTION TYPES (You can ONLY use these types):
- HeroSection: { "headline": string, "subheadline": string, "ctaText": string, "backgroundImage": string }
- ServicesSection: { "items": Array<{ slug: string, name: string, description: string, icon: string, image: string }> }
- AboutSection: { "story": string, "mission": string, "values": Array<{title: string, description: string}>, "team": Array<{name: string, role: string, photo: string}> }
- BrandsSection: Array<{ name: string, icon: string }>
- WhyUsSection: Array<{ title: string, description: string, icon: string }>
- TestimonialsSection: Array<{ name: string, text: string, rating: number, role?: string, avatar?: string }>
- BeforeAfterSection: Array<{ title: string, description: string, beforeImage: string, afterImage: string }>
- TimelineSection: Array<{ step: number, title: string, description: string }>
- LocationsSection: { "items": Array<{ slug: string, name: string, description: string, image: string }> }

Do not invent new section types. Use the supported ones to compose the page.`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 8192,
      responseFormat: 'json',
    });

    this.logger.debug(`[${pageSlug}] Raw LLM output: ${response.text}`);

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
      throw new Error(`PageContent LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }

    // Normalize: handle nested wrappers like { pageContent: { slug, ... } }
    if (!parsed.slug && parsed.pageContent) {
      parsed = parsed.pageContent;
    }
    if (!parsed.slug && parsed.page_content) {
      parsed = parsed.page_content;
    }
    // Force the slug to be correct just in case the LLM hallucinated a different one
    if (parsed && !parsed.slug) {
      parsed.slug = pageSlug;
    }

    const validatedData = this.validator.validate(parsed, PageContentSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: 'claude-fable-5',
    };
  }
}
