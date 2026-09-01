import { Injectable, Logger } from '@nestjs/common';
import { SkillExecutorService } from './skill-executor.service';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SectionContentSkill } from './impl/section-content.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly executor: SkillExecutorService,
    private readonly brandVoice: BrandVoiceSkill,
    private readonly brandIdentity: BrandIdentitySkill,
    private readonly designSystem: DesignSystemSkill,
    private readonly pageStructure: PageStructureSkill,
    private readonly sectionContent: SectionContentSkill,
    private readonly seoMetadata: SeoMetadataSkill,
  ) {}

  private async executeWithRetries(skill: any, input: any, retries: number = 3): Promise<any> {
    let attempt = 1;
    while (attempt <= retries) {
      try {
        return await this.executor.executeSkill(skill, input);
      } catch (error) {
        this.logger.warn(`Skill ${skill.name} failed on attempt ${attempt}: ${error.message}`);
        if (attempt === retries) throw error;
        attempt++;
      }
    }
  }

  async generateWebsite(
    projectId: string, 
    businessContext: any, 
    onPageGenerated?: (page: any) => Promise<void>
  ) {
    this.logger.log(`Starting 3-phase generation pipeline for project ${projectId}`);

    // Phase 1: Brand Identity and Brand Voice (Parallel)
    const phase1Input = { projectId, context: businessContext };
    
    const [brandIdentitySettled, brandVoiceSettled] = await Promise.allSettled([
      this.executeWithRetries(this.brandIdentity, phase1Input),
      this.executeWithRetries(this.brandVoice, phase1Input),
    ]);

    if (brandIdentitySettled.status === 'rejected') {
      this.logger.error(`BrandIdentity skill failed: ${brandIdentitySettled.reason}`);
      throw brandIdentitySettled.reason;
    }
    if (brandVoiceSettled.status === 'rejected') {
      this.logger.error(`BrandVoice skill failed: ${brandVoiceSettled.reason}`);
      throw brandVoiceSettled.reason;
    }

    const brandIdentityResult = brandIdentitySettled.value;
    const brandVoiceResult = brandVoiceSettled.value;

    // Phase 2: Design System (Sequential, relies on Brand Identity)
    const phase2Input = {
      projectId,
      context: {
        businessContext,
        brandIdentity: brandIdentityResult,
      }
    };
    const designSystemResult = await this.executeWithRetries(this.designSystem, phase2Input);

    // Phase 3: SEO Metadata (Parallel with pages)
    const phase3Input = {
      projectId,
      context: {
        businessContext,
        brandVoice: brandVoiceResult,
        designSystem: designSystemResult,
      }
    };

    const seoPromise = this.executeWithRetries(this.seoMetadata, phase3Input);

    // Determine Pages to generate
    const pagesToGenerate = ['home', 'about-us', 'services', 'service-areas', 'portfolio', 'contact'];
    
    // Add dynamic pages for each service and location
    if (businessContext.services && Array.isArray(businessContext.services)) {
      businessContext.services.forEach((service: any) => {
        const slug = typeof service === 'string' 
          ? service.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
          : service.slug;
        if (slug) pagesToGenerate.push(`services/${slug}`);
      });
    }
    if (businessContext.serviceAreas && Array.isArray(businessContext.serviceAreas)) {
      businessContext.serviceAreas.forEach((area: any) => {
        const slug = typeof area === 'string' 
          ? area.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
          : area.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (slug) pagesToGenerate.push(`service-areas/${slug}`);
      });
    }

    this.logger.log(`Generating ${pagesToGenerate.length} pages: ${pagesToGenerate.join(', ')}`);

    const successfulPages: any[] = [];

    // Phase 3: Page Generation (Sequential per page to manage load, or can be parallel)
    for (const pageSlug of pagesToGenerate) {
      try {
        this.logger.log(`[${pageSlug}] Starting page generation...`);
        
        // 1. Get Page Structure
        const structureResult = await this.executeWithRetries(this.pageStructure, {
          projectId,
          context: { ...phase3Input.context, pageSlug }
        });
        
        const sectionTypes: string[] = structureResult.sections;
        this.logger.log(`[${pageSlug}] Structure determined: ${sectionTypes.join(', ')}`);

        const generatedSections: any[] = [];

        // 2. Generate Sections (Sequential to respect rate limits & dependencies)
        for (const sectionType of sectionTypes) {
          let sectionData = null;
          let retries = 3;
          let attempt = 1;

          while (attempt <= retries && !sectionData) {
            try {
              this.logger.log(`[${pageSlug}] Generating ${sectionType} (Attempt ${attempt}/${retries})`);
              const result = await this.executeWithRetries(this.sectionContent, {
                projectId,
                context: { ...phase3Input.context, pageSlug, sectionType }
              }, 1); // Pass 1 because the while loop here already handles retries and fallbacks
              
              sectionData = result;
            } catch (error) {
              this.logger.warn(`[${pageSlug}] Failed to generate ${sectionType} on attempt ${attempt}: ${error.message}`);
              attempt++;
            }
          }

          if (sectionData) {
            generatedSections.push(sectionData);
          } else {
            this.logger.error(`[${pageSlug}] Exhausted retries for ${sectionType}. Using fallback.`);
            // Inject fallback static JSON based on section type
            generatedSections.push(this.getFallbackSection(sectionType));
          }
        }

        // Assemble the page
        const pagePayload = {
          slug: pageSlug,
          sections: generatedSections
        };
        successfulPages.push(pagePayload);
        
        if (onPageGenerated) {
          try {
            await onPageGenerated(pagePayload);
          } catch (err) {
            this.logger.error(`[${pageSlug}] Failed to execute onPageGenerated callback: ${err.message}`);
          }
        }
        
        this.logger.log(`[${pageSlug}] Successfully generated ${generatedSections.length} sections and saved to DB.`);

      } catch (error) {
        this.logger.error(`Failed to generate page ${pageSlug}: ${error.message}`);
      }
    }

    const seoMetadataResult = await seoPromise;

    // Phase 3: Assembly (Aggregating results for the Generation consumer)
    return {
      designTokens: designSystemResult,
      brandVoice: brandVoiceResult,
      pages: successfulPages,
      seoMetadata: seoMetadataResult,
    };
  }

  private getFallbackSection(sectionType: string): any {
    // A minimal valid structure for each section type to satisfy the frontend if AI fails
    const id = `fallback-${sectionType.toLowerCase()}-${Date.now()}`;
    const base = { id, type: sectionType };

    switch (sectionType) {
      case 'HeroSection':
        return { ...base, content: { headline: "Welcome", subheadline: "Professional services.", ctaText: "Contact Us", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'PageHeaderSection':
        return { ...base, content: { title: "Page Content", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'BrandsSection':
        return { ...base, content: [{ name: "Certified Pro", icon: "Award" }] };
      case 'ServicesSection':
        return { ...base, content: { items: undefined } }; // Fallback to global
      case 'AboutSection':
        return { ...base, content: { story: "We are professionals.", mission: "To deliver quality.", values: [], team: [] } };
      case 'WhyUsSection':
        return { ...base, content: [{ title: "Experience", description: "Years of experience.", icon: "CheckCircle" }] };
      case 'BeforeAfterSection':
        return { ...base, content: [] };
      case 'TimelineSection':
        return { ...base, content: [] };
      case 'TestimonialsSection':
        return { ...base, content: [] };
      case 'LocationsSection':
        return { ...base, content: { items: undefined } }; // Fallback to global
      case 'ServiceDetailsSection':
        return { ...base, content: { overview: "Service overview.", whyChooseUs: ["Quality"], process: ["Step 1"], cta: { heading: "Need help?", subheading: "Contact us.", buttonText: "Get Quote" } } };
      case 'CallToActionSection':
        return { ...base, content: { heading: "Ready to start?", subheading: "Get a free quote today.", buttonText: "Contact Us" } };
      default:
        // Generic fallback to prevent crashing SectionRenderer
        return { ...base, content: {} };
    }
  }
}
