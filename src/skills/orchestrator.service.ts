import { Injectable, Logger } from '@nestjs/common';
import { SkillExecutorService } from './skill-executor.service';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';
import { KeywordStrategySkill } from './impl/keyword-strategy.skill';
import { CSSStyleSkill } from './impl/css-style.skill';
import { CopyWriterSkill } from './impl/copy-writer.skill';
import { UIDesignerSkill } from './impl/ui-designer.skill';
import { ComponentGeneratorSkill } from './impl/component-generator.skill';
import { PrismaService } from '../prisma/prisma.service';
import { UnsplashService } from '../images/unsplash.service';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly executor: SkillExecutorService,
    private readonly brandVoice: BrandVoiceSkill,
    private readonly brandIdentity: BrandIdentitySkill,
    private readonly designSystem: DesignSystemSkill,
    private readonly pageStructure: PageStructureSkill,
    private readonly seoMetadata: SeoMetadataSkill,
    private readonly keywordStrategy: KeywordStrategySkill,
    private readonly cssStyle: CSSStyleSkill,
    private readonly copyWriter: CopyWriterSkill,
    private readonly uiDesigner: UIDesignerSkill,
    private readonly componentGenerator: ComponentGeneratorSkill,
    private readonly prisma: PrismaService,
    private readonly unsplash: UnsplashService,
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
    this.logger.log(`Starting 6-phase generation pipeline for project ${projectId}`);

    // Determine Pages to generate early so we can pass to Keyword Strategy
    const pagesToGenerate = ['home', 'about-us', 'services', 'service-areas', 'portfolio', 'contact', 'privacy-policy', 'terms-of-service', 'layout'];
    
    // Add dynamic pages for each service and location
    const serviceSlugs: string[] = [];
    if (businessContext.services && Array.isArray(businessContext.services)) {
      businessContext.services.forEach((service: any) => {
        const slug = typeof service === 'string' 
          ? service.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
          : (service.slug || service.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        if (slug) {
          pagesToGenerate.push(`services/${slug}`);
          serviceSlugs.push(slug);
        }
      });
    }

    // Fetch the cities we generated keyword metrics for
    const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
      where: { projectId },
      select: { city: true },
      distinct: ['city']
    });

    const isLocationServicePageMap = new Set<string>();

    if (locationMetrics.length > 0 && serviceSlugs.length > 0) {
      locationMetrics.forEach(metric => {
        const citySlug = metric.city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        serviceSlugs.forEach(serviceSlug => {
          const nestedSlug = `${citySlug}/${serviceSlug}`;
          pagesToGenerate.push(nestedSlug);
          isLocationServicePageMap.add(nestedSlug);
        });
      });
    } else if (businessContext.serviceAreas && Array.isArray(businessContext.serviceAreas)) {
      // Fallback if no metrics were generated yet
      businessContext.serviceAreas.forEach((area: any) => {
        const citySlug = typeof area === 'string' 
          ? area.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
          : area.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        if (citySlug) {
          serviceSlugs.forEach(serviceSlug => {
            const nestedSlug = `${citySlug}/${serviceSlug}`;
            pagesToGenerate.push(nestedSlug);
            isLocationServicePageMap.add(nestedSlug);
          });
        }
      });
    }

    // --- PHASE 1: Brand & Design System ---
    this.logger.log('Phase 1: Brand & Design System');
    const phase1Input = { projectId, context: { businessContext } };
    
    const existingWebsiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
    
    let brandIdentityResult = null;
    let brandVoiceResult = null;
    let designSystemResult = existingWebsiteData?.designTokens || null;
    let globalCssResult = null; // Stored in site-template eventually, but for now we re-generate or assume it's not strictly needed for page loop if already done

    if (!designSystemResult) {
      const [brandIdentitySettled, brandVoiceSettled] = await Promise.allSettled([
        this.executeWithRetries(this.brandIdentity, phase1Input),
        this.executeWithRetries(this.brandVoice, phase1Input),
      ]);

      if (brandIdentitySettled.status === 'rejected') throw brandIdentitySettled.reason;
      if (brandVoiceSettled.status === 'rejected') throw brandVoiceSettled.reason;

      brandIdentityResult = brandIdentitySettled.value;
      brandVoiceResult = brandVoiceSettled.value;

      designSystemResult = await this.executeWithRetries(this.designSystem, {
        projectId,
        context: { businessContext, brandIdentity: brandIdentityResult }
      });

      globalCssResult = await this.executeWithRetries(this.cssStyle, {
        projectId,
        context: { designSystem: designSystemResult }
      });
      
      await this.prisma.websiteData.update({
        where: { projectId },
        data: { designTokens: designSystemResult ? (designSystemResult as any) : undefined, generationStatus: 'components' }
      });
    } else {
        this.logger.log('Skipping Phase 1 - Design System already exists');
        // Still need brandVoice/brandIdentity for later stages if we resume, ideally we should persist these to DB.
        // For MVP of resumability, we can re-run them quickly (they are cheap), or assume we don't need them if we already have the DesignSystem.
        // Let's re-run just identity and voice since they aren't saved to DB independently right now.
        brandIdentityResult = await this.executeWithRetries(this.brandIdentity, phase1Input);
        brandVoiceResult = await this.executeWithRetries(this.brandVoice, phase1Input);
    }



    // --- PHASE 2: Keyword Strategy ---
    this.logger.log('Phase 2: Keyword Strategy');
    let keywordStrategyResult = existingWebsiteData?.seoMetadata as any;
    
    if (!keywordStrategyResult || !keywordStrategyResult.pages) {
        keywordStrategyResult = await this.executeWithRetries(this.keywordStrategy, {
          projectId,
          context: { businessContext, pages: pagesToGenerate.filter(p => p !== 'layout') }
        });
        await this.prisma.websiteData.update({
            where: { projectId },
            data: { seoMetadata: keywordStrategyResult, generationStatus: 'pages' }
        });
    } else {
        this.logger.log('Skipping Phase 2 - Keyword Strategy already exists');
    }

    const successfulPages: any[] = [];

    // --- PHASE 3, 4, 5: Per-Page Generation ---
    for (const pageSlug of pagesToGenerate) {
      try {
        // Check if page already exists and is completed
        const existingPage = await this.prisma.page.findUnique({
          where: { projectId_slug: { projectId, slug: pageSlug } }
        });
        
        if (existingPage && existingPage.status === 'completed') {
           this.logger.log(`\n[${pageSlug}] Skipping - already completed`);
           successfulPages.push({
               slug: existingPage.slug,
               sections: existingPage.content,
               componentCode: existingPage.componentCode,
               seoMeta: existingPage.seoMeta,
               keywordTarget: existingPage.keywordTarget
           });
           continue;
        }

        this.logger.log(`\n[${pageSlug}] Starting Generation Loop`);

        // Find assigned keyword
        const keywordTarget = keywordStrategyResult.pages.find((p: any) => p.slug === pageSlug);

        // Phase 3: SEO Metadata
        let seoResult = null;
        if (pageSlug !== 'layout') {
          seoResult = await this.executeWithRetries(this.seoMetadata, {
            projectId,
            context: { businessContext, pageSlug, keywordTarget }
          });
        }

        // Phase 4a: Page Structure
        const isLocationServicePage = isLocationServicePageMap.has(pageSlug);
        let serviceSlug = null;
        if (isLocationServicePage) {
          const parts = pageSlug.split('/');
          if (parts.length === 2) serviceSlug = parts[1];
        }

        let sectionTypes: string[] = [];
        if (pageSlug === 'layout') {
          sectionTypes = ['HeaderSection', 'FooterSection'];
        } else {
          const structureResult = await this.executeWithRetries(this.pageStructure, {
            projectId,
            context: { businessContext, brandVoice: brandVoiceResult, pageSlug, isLocationServicePage }
          });
          sectionTypes = structureResult.sections;
        }

        const generatedSections: any[] = [];
        const generatedComponents: Record<string, string> = {};

        // Phase 4b & 5: Copy and Component Code
        for (const sectionType of sectionTypes) {
          const componentName = sectionType; // e.g. "HeroSection"
          
          // Generate the reusable .tsx component if we don't have it yet
          let websiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
          let customComponents = (websiteData?.customComponents as Record<string, string>) || {};
          
          if (!customComponents[componentName]) {
            try {
              this.logger.log(`[${pageSlug}] Generating new component: ${componentName}`);
              const componentResult = await this.executeWithRetries(this.componentGenerator, {
                projectId,
                context: { sectionType: componentName, brandIdentity: brandIdentityResult }
              }, 2);
              
              customComponents[componentName] = componentResult.code;
              await this.prisma.websiteData.update({
                where: { projectId },
                data: { customComponents }
              });
            } catch (err) {
              this.logger.warn(`Failed to generate component ${componentName}: ${err.message}`);
            }
          }

          // Fallback mechanism per section
          let sectionCopy = null;
          try {
            // 1. Generate Raw Copy
            const copyDataResult = await this.executeWithRetries(this.copyWriter, {
              projectId,
              context: { businessContext, brandVoice: brandVoiceResult, seoMeta: seoResult, sectionType, pageSlug, isLocationServicePage, serviceSlug }
            }, 2);

            // 2. Generate UI AST Layout
            sectionCopy = await this.executeWithRetries(this.uiDesigner, {
              projectId,
              context: { sectionType, brandIdentity: brandIdentityResult, copyData: copyDataResult, pageSlug }
            }, 2);
          } catch (error) {
            this.logger.warn(`[${pageSlug}] Failed to generate section ${sectionType}: ${error.message}`);
          }

          // Apply Fallback if generation failed
          if (!sectionCopy) {
            sectionCopy = this.getFallbackSection(sectionType);
          }

          // Intercept and resolve Unsplash images
          if (sectionCopy) {
            if (sectionCopy.content) {
              await this.resolveImages(sectionCopy.content);
            }
            if (sectionCopy.ast?.props?.data) {
              await this.resolveImages(sectionCopy.ast.props.data);
            }
          }

          generatedSections.push(sectionCopy);
        }

        const pagePayload = {
          slug: pageSlug,
          sections: generatedSections,
          componentCode: Object.keys(generatedComponents).length > 0 ? generatedComponents : null,
          seoMeta: seoResult,
          keywordTarget,
          status: 'completed'
        };
        
        successfulPages.push(pagePayload);
        
        if (onPageGenerated) {
          try {
            await onPageGenerated(pagePayload);
          } catch (err) {
            this.logger.error(`[${pageSlug}] Failed to execute onPageGenerated callback: ${err.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to generate page ${pageSlug}: ${error.message}`);
      }
    }

    // Phase 6 will be handled by the NextjsBuilderService when it consumes this data.

    return {
      designTokens: designSystemResult,
      globalCss: globalCssResult,
      brandVoice: brandVoiceResult,
      keywordStrategy: keywordStrategyResult,
      pages: successfulPages,
    };
  }

  private getFallbackSection(sectionType: string): any {
    const id = `fallback-${sectionType.toLowerCase()}-${Date.now()}`;
    const base = { id, type: sectionType };

    switch (sectionType) {
      case 'HeroSection': return { ...base, content: { title: "Welcome", description: "Professional services.", eyebrow: "Top Rated", ctaText: "Contact Us", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459", googleReviews: { rating: 5.0, count: 120 }, buttons: [{ text: "View Portfolio", link: "#portfolio" }] } };
      case 'PageHeaderSection': return { ...base, content: { title: "Page Content", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'BrandsSection': return { ...base, content: [{ name: "Certified Pro", icon: "Award" }] };
      case 'ServicesSection': return { ...base, content: { tagline: "What We Do", title: "Our Services", description: "Professional services built to last.", bullets: ["Expert craftsmanship", "Satisfaction guaranteed"], linkText: "Learn More", items: undefined } };
      case 'AboutSection': return { ...base, content: { eyebrow: "About Us", title: "Your Local Experts", description: "Led by John Doe, we are professionals.", image: "https://images.unsplash.com/photo-1541888053-ce2073fb1155", ctaText: "Read More" } };
      case 'WhyUsSection': return { ...base, content: { tagline: "Why Choose Us", title: "Experience the difference", description: "Our unique selling points.", items: [{ title: "Experience", description: "Years of experience.", icon: "CheckCircle" }] } };
      case 'BeforeAfterSection': return { ...base, content: [{ title: "Amazing Transformation", description: "See the difference we can make.", beforeImage: "https://images.unsplash.com/photo-1541888053-ce2073fb1155", afterImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" }] };
      case 'TimelineSection': return { ...base, content: { tagline: "How It Works", title: "Our Process", description: "Simple and transparent process.", items: [{ step: 1, title: "Consultation", description: "Initial meeting.", icon: "Headphones" }] } };
      case 'TestimonialsSection': return { ...base, content: { tagline: "Testimonials", title: "What Our Clients Say", description: "Read what our clients have to say.", items: [{ name: "Jane Doe", text: "Great service!", rating: 5.0 }] } };
      case 'LocationsSection': return { ...base, content: { tagline: "Coverage", title: "Our Service Areas", linkText: "View Area", items: undefined } }; 
      case 'ServiceDetailsSection': return { ...base, content: { overview: "Service overview.", whyChooseUs: ["Quality"], process: ["Step 1"], cta: { heading: "Need help?", subheading: "Contact us.", buttonText: "Get Quote" } } };
      case 'CallToActionSection': return { ...base, content: { heading: "Ready to start?", subheading: "Get a free quote today.", buttonText: "Contact Us" } };
      case 'LeadFormSection': return { ...base, content: { heading: "Request a Quote", subheading: "Fill out the form below.", submitButtonText: "Submit" } };
      case 'GallerySection': return { ...base, content: { title: "Our Work", images: [{ url: "https://images.unsplash.com/photo-1541888081622-17b587b1c459", alt: "Work 1", serviceName: "General" }], ctaText: "View Details", ctaLink: "/services" } };
      case 'FaqSection': return { ...base, content: { tagline: "FAQ", title: "Frequently Asked Questions", description: "Answers to common questions.", items: [{ question: "What is your process?", answer: "We start with a consultation." }] } };
      case 'FindUsSection': return { ...base, content: { title: "Find Us", mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3313.2!2d-118.2!3d34.05!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzTCsDAzJzAwLjAiTiAxMTjCgDEyJzAwLjAiVw!5e0!3m2!1sen!2sus!4v1", address: "123 Main St", phone: "555-0100", email: "info@example.com", hours: { "Monday - Friday": "9am - 5pm" } } };
      default: return { ...base, content: {} };
    }
  }

  private async resolveImages(obj: any): Promise<void> {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('UNSPLASH:')) {
        const query = val.replace('UNSPLASH:', '').trim();
        const url = await this.unsplash.searchImage(query);
        if (url) {
          obj[key] = url;
        }
      } else if (typeof val === 'object') {
        await this.resolveImages(val);
      }
    }
  }
}
