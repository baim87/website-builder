import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { SectionSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';

@Injectable()
export class SectionContentSkill implements Skill {
  readonly name = 'SectionContent';
  private readonly logger = new Logger(SectionContentSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly validator: OutputValidatorService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const pageSlug = input.context.pageSlug || 'home';
    const sectionType = input.context.sectionType;
    
    if (!sectionType) {
      throw new Error('SectionContentSkill requires sectionType in context');
    }

    const prompt = `Generate content for a "${sectionType}" section on the "${pageSlug}" page.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object exactly matching this structure (no markdown fences, no explanation):
{
  "id": "unique-${sectionType.toLowerCase()}-${Math.random().toString(36).substring(7)}",
  "type": "${sectionType}",
  "content": <INSERT_OBJECT_OR_ARRAY_HERE>
}

- HeroSection: { headline: string, subheadline: string, ctaText: string, backgroundImage: string }
- PageHeaderSection: { title: string, description: string, badge: string, backgroundImage: string }
- BrandsSection: [ { name: string, icon: string } ]
- ServicesSection: { items: [ { slug: string, name: string, description: string, icon: string, image: string } ] }
- AboutSection: { story: string, mission: string, values: [{title: string, description: string}], team: [{name: string, role: string, photo: string}] }
- WhyUsSection: [ { title: string, description: string, icon: string } ]
- BeforeAfterSection: [ { title: string, beforeImage: string, afterImage: string, description: string } ]
- TimelineSection: [ { step: number, title: string, description: string } ]
- TestimonialsSection: [ { name: string, text: string, rating: number, avatar: string, role: string, projectImage: string } ]
- LocationsSection: { items: [ { slug: string, name: string, description: string, image: string } ] }
- ServiceDetailsSection: { overview: string, whyChooseUs: [string], process: [string], cta: { heading: string, subheading: string, buttonText: string } }
- CallToActionSection: { heading: string, subheading: string, buttonText: string, backgroundImage: string }
`;

    const response = await this.aiGateway.generateText('claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1500,
      responseFormat: 'json',
    });

    this.logger.debug(`[${pageSlug}] SectionContent (${sectionType}) raw output: ${response.text.substring(0, 100)}...`);

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
      throw new Error(`SectionContent LLM returned unparseable output`);
    }

    // Force the type to match exactly what we requested, in case LLM hallucinates
    if (parsed) {
      parsed.type = sectionType;
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
