import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PageStructureSchema } from '../schemas/skill-outputs.schema';
import * as crypto from 'crypto';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { buildPageStructurePrompt } from '../prompts/builders/page-structure.prompt';
import { parseJsonFromLlm } from '../../guardrails/llm-parser';

@Injectable()
export class PageStructureSkill implements Skill {
  readonly name = AISkill.PAGE_STRUCTURE;
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
        'AnnouncementBarSection', 'HeroSection', 'BrandsSection', 'AboutSection', 'ServicesSection', 'WhyUsSection', 
        'GallerySection', 'TimelineSection', 'TestimonialsSection', 'CallToActionSection'
      ],
      'about-us': [
        'PageHeaderSection', 'AboutSection', 'WhyUsSection', 'LocationsSection', 
        'TestimonialsSection', 'CallToActionSection'
      ],
      'portfolio': [
        'PageHeaderSection', 'GallerySection'
      ],
      'services': [
        'PageHeaderSection', 'ServicesSection'
      ],
      'service-areas': [
        'PageHeaderSection', 'LocationsSection', 'TestimonialsSection', 'CallToActionSection'
      ],
      'contact': [
        'PageHeaderSection', 'LeadFormSection', 'FindUsSection'
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
    
    const prompt = buildPageStructurePrompt(
      pageSlug,
      input.context.businessContext,
      input.context.brandVoice,
      input.context.brandStrategy,
      input.context.brandPositioning
    );

    const fullJsonSchema = zodToJsonSchema(PageStructureSchema, 'PageStructure');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['PageStructure']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Website Architect. Output structured data via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'PageStructure',
    });

    this.logger.debug(`[${pageSlug}] PageStructure output: ${response.text}`);

    const parsed = parseJsonFromLlm(response.text);

    const validatedData = this.validator.validate(parsed, PageStructureSchema);
    const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');

    return {
      data: validatedData,
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
