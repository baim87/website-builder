import { Injectable, Logger } from '@nestjs/common';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { BrandVoiceSkill } from '../skills/impl/brand-voice.skill';
import { BrandIdentitySkill } from '../skills/impl/brand-identity.skill';
import { DesignSystemSkill } from '../skills/impl/design-system.skill';
import { PageStructureSkill } from '../skills/impl/page-structure.skill';
import { SeoMetadataSkill } from '../skills/impl/seo-metadata.skill';
import { KeywordStrategySkill } from '../skills/impl/keyword-strategy.skill';
import { CSSStyleSkill } from '../skills/impl/css-style.skill';
import { CopyWriterSkill } from '../skills/impl/copy-writer.skill';
import { UIDesignerSkill } from '../skills/impl/ui-designer.skill';
import { ComponentGeneratorSkill } from '../skills/impl/component-generator.skill';
import { PrismaService } from '../prisma/prisma.service';
import { UnsplashService } from '../assets/unsplash.service';

import { ImagePlannerSkill } from '../skills/impl/image-planner.skill';
import { ImageGenerationProducer } from '../queue/producers/image-generation.producer';
import { PartnerBrandService } from '../assets/partner-brand.service';
import { ServiceRankingService } from '../keywords/service-ranking.service';
import { SeasonalityService } from '../keywords/seasonality.service';

export interface GenerationContext {
  projectId: string;
  businessContext: any;
  pagesToGenerate: string[];
  serviceSlugs: string[];
  isLocationServicePageMap: Set<string>;
  existingWebsiteData: any;
  themePreference: string;
  
  brandIdentityResult?: any;
  brandVoiceResult?: any;
  designSystemResult?: any;
  globalCssResult?: any;
  keywordStrategyResult?: any;
  combinedAssets?: any[];
}

@Injectable()
export class GenerationOrchestratorService {
  private readonly logger = new Logger(GenerationOrchestratorService.name);

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
    private readonly imagePlanner: ImagePlannerSkill,
    private readonly imageGenerationProducer: ImageGenerationProducer,
    private readonly prisma: PrismaService,
    private readonly unsplash: UnsplashService,
    private readonly partnerBrandService: PartnerBrandService,
    private readonly serviceRankingService: ServiceRankingService,
    private readonly seasonalityService: SeasonalityService,
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

    const ctx = await this.initializeContext(projectId, businessContext);
    
    await this.executePhase0Intelligence(ctx);
    await this.executePhase1BrandDesign(ctx);
    await this.executePhase2KeywordStrategy(ctx);
    await this.executePhase2_5ImagePlanning(ctx);
    
    const successfulPages = await this.executePhase3To5PageLoop(ctx, onPageGenerated);

    return {
      designTokens: ctx.designSystemResult,
      globalCss: ctx.globalCssResult,
      brandVoice: ctx.brandVoiceResult,
      keywordStrategy: ctx.keywordStrategyResult,
      pages: successfulPages,
    };
  }

  private async initializeContext(projectId: string, businessContext: any): Promise<GenerationContext> {
    const pagesToGenerate = ['home', 'about-us', 'services', 'service-areas', 'portfolio', 'contact', 'privacy-policy', 'terms-of-service', 'layout'];
    const serviceSlugs: string[] = [];
    const isLocationServicePageMap = new Set<string>();

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

    const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
      where: { projectId },
      select: { city: true },
      distinct: ['city']
    });

    const allCities = new Set<string>();
    if (locationMetrics.length > 0) {
      locationMetrics.forEach(metric => allCities.add(metric.city));
    }
    
    if (businessContext.serviceAreas && Array.isArray(businessContext.serviceAreas)) {
      businessContext.serviceAreas.forEach((area: any) => {
        const cityName = typeof area === 'string' ? area : area.name;
        if (cityName) allCities.add(cityName);
      });
    }

    if (allCities.size > 0 && serviceSlugs.length > 0) {
      allCities.forEach(city => {
        const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        serviceSlugs.forEach(serviceSlug => {
          const nestedSlug = `service-areas/${citySlug}/${serviceSlug}`;
          pagesToGenerate.push(nestedSlug);
          isLocationServicePageMap.add(nestedSlug);
        });
      });
    }

    let existingWebsiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
    if (!existingWebsiteData) {
      existingWebsiteData = await this.prisma.websiteData.create({ data: { projectId } });
    }

    const themePreference = businessContext.brandIdentityInputs?.themePreference || 'modern-minimalist';

    return {
      projectId,
      businessContext,
      pagesToGenerate,
      serviceSlugs,
      isLocationServicePageMap,
      existingWebsiteData,
      themePreference
    };
  }

  private async executePhase0Intelligence(ctx: GenerationContext) {
    this.logger.log('Phase 0: Pre-Generation Intelligence');
    
    const servicesList = Array.isArray(ctx.businessContext.services) 
      ? ctx.businessContext.services.map((s: any) => typeof s === 'string' ? s : (s.name || s.title || 'Service'))
      : [];
      
    await this.serviceRankingService.rankServices(
      ctx.projectId,
      servicesList,
      ctx.businessContext.location || 'Unknown City',
      ctx.businessContext.county,
      ctx.businessContext.state
    );
    
    const seasonalConfig = { announcementBar: await this.seasonalityService.generateSeasonalConfig(ctx.projectId) };
    
    const serviceKeywordMetrics = await this.prisma.serviceKeywordMetrics.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { rank: 'asc' }
    });
    
    await this.prisma.websiteData.update({
      where: { projectId: ctx.projectId },
      data: { 
        serviceRanking: serviceKeywordMetrics as any,
        seasonalConfig: seasonalConfig as any 
      },
    });
    
    ctx.businessContext.seasonalConfig = seasonalConfig;
    ctx.businessContext.serviceRanking = serviceKeywordMetrics;
  }

  private async executePhase1BrandDesign(ctx: GenerationContext) {
    this.logger.log('Phase 1: Brand & Design System');
    const phase1Input = { projectId: ctx.projectId, context: { businessContext: ctx.businessContext, themePreference: ctx.themePreference }, metadata: { phase: 'generation' } };
    
    ctx.designSystemResult = ctx.existingWebsiteData?.designTokens || null;

    if (!ctx.designSystemResult) {
      const [brandIdentitySettled, brandVoiceSettled] = await Promise.allSettled([
        this.executeWithRetries(this.brandIdentity, phase1Input),
        this.executeWithRetries(this.brandVoice, phase1Input),
      ]);

      if (brandIdentitySettled.status === 'rejected') throw brandIdentitySettled.reason;
      if (brandVoiceSettled.status === 'rejected') throw brandVoiceSettled.reason;

      ctx.brandIdentityResult = brandIdentitySettled.value;
      ctx.brandVoiceResult = brandVoiceSettled.value;

      ctx.designSystemResult = await this.executeWithRetries(this.designSystem, {
        projectId: ctx.projectId,
        context: { businessContext: ctx.businessContext, brandIdentity: ctx.brandIdentityResult, themePreference: ctx.themePreference },
        metadata: { phase: 'generation' }
      });

      ctx.globalCssResult = await this.executeWithRetries(this.cssStyle, {
        projectId: ctx.projectId,
        context: { designSystem: ctx.designSystemResult, themePreference: ctx.themePreference },
        metadata: { phase: 'generation' }
      });
      
      await this.prisma.websiteData.update({
        where: { projectId: ctx.projectId },
        data: { designTokens: ctx.designSystemResult ? (ctx.designSystemResult as any) : undefined, generationStatus: 'components' }
      });
    } else {
        this.logger.log('Skipping Phase 1 - Design System already exists');
        ctx.brandIdentityResult = await this.executeWithRetries(this.brandIdentity, phase1Input);
        ctx.brandVoiceResult = await this.executeWithRetries(this.brandVoice, phase1Input);
    }
  }

  private async executePhase2KeywordStrategy(ctx: GenerationContext) {
    this.logger.log('Phase 2: Keyword Strategy & Asset Planning');
    ctx.keywordStrategyResult = ctx.existingWebsiteData?.seoMetadata as any;
    
    if (!ctx.keywordStrategyResult || !ctx.keywordStrategyResult.pages) {
        ctx.keywordStrategyResult = await this.executeWithRetries(this.keywordStrategy, {
          projectId: ctx.projectId,
          context: { businessContext: ctx.businessContext, pages: ctx.pagesToGenerate.filter(p => p !== 'layout') },
          metadata: { phase: 'generation' }
        });
        await this.prisma.websiteData.update({
            where: { projectId: ctx.projectId },
            data: { seoMetadata: ctx.keywordStrategyResult, generationStatus: 'pages' }
        });
    } else {
        this.logger.log('Skipping Phase 2 - Keyword Strategy already exists');
    }
  }

  private async executePhase2_5ImagePlanning(ctx: GenerationContext) {
    this.logger.log('Phase 2.25: Extracting and Caching Partner Brands');
    const existingBrands = await this.prisma.asset.count({ where: { projectId: ctx.projectId, purpose: 'partner_brand' } });
    if (existingBrands === 0 && ctx.businessContext.trade) {
      await this.partnerBrandService.processPartnerBrands(ctx.projectId, ctx.businessContext.trade, ctx.businessContext.services || []);
    }

    this.logger.log('Phase 2.5: Image Planning & Generation Setup');
    const existingAssets = await this.prisma.projectAsset.count({ where: { projectId: ctx.projectId } });
    if (existingAssets === 0) {
      const imagePlanResult = await this.executeWithRetries(this.imagePlanner, {
        projectId: ctx.projectId,
        context: { businessContext: ctx.businessContext, pagesToGenerate: ctx.pagesToGenerate },
        metadata: { phase: 'generation' }
      });
      
      const { assets } = imagePlanResult;
      this.logger.log(`Queueing ${assets.length} images for generation...`);
      for (const asset of assets) {
        const project = await this.prisma.project.findUnique({ where: { id: ctx.projectId } });
        if (project) {
          await this.imageGenerationProducer.generateImage(ctx.projectId, project.userId, asset.id);
        }
      }
    } else {
      this.logger.log('Skipping Image Planning - Assets already planned');
    }

    this.logger.log('Phase 2.75: Waiting for all planned images to finish generating before proceeding...');
    let allImagesCompleted = false;
    let waitLoopCount = 0;
    const MAX_WAIT_LOOPS = 120; // 10 minutes timeout (120 * 5s)

    while (!allImagesCompleted) {
      if (waitLoopCount >= MAX_WAIT_LOOPS) {
        this.logger.warn(`Image generation polling timed out after 10 minutes. Proceeding with remaining completed images.`);
        // Fail any remaining pending images
        await this.prisma.projectAsset.updateMany({
          where: { projectId: ctx.projectId, status: { in: ['pending', 'generating'] } },
          data: { status: 'failed' },
        });
        break;
      }

      const [pendingAssets, completedAssets, failedAssets, totalAssets] = await Promise.all([
        this.prisma.projectAsset.count({ where: { projectId: ctx.projectId, status: { in: ['pending', 'generating'] } } }),
        this.prisma.projectAsset.count({ where: { projectId: ctx.projectId, status: 'completed' } }),
        this.prisma.projectAsset.count({ where: { projectId: ctx.projectId, status: 'failed' } }),
        this.prisma.projectAsset.count({ where: { projectId: ctx.projectId } }),
      ]);
      
      if (pendingAssets === 0) {
        allImagesCompleted = true;
        this.logger.log(`✓ All images complete! ${completedAssets} succeeded, ${failedAssets} failed out of ${totalAssets} total.`);
      } else {
        if (waitLoopCount % 3 === 0) {
          this.logger.log(`⏳ Image progress: ${completedAssets}/${totalAssets} done, ${pendingAssets} remaining, ${failedAssets} failed. Waiting...`);
        }
        waitLoopCount++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async executePhase3To5PageLoop(ctx: GenerationContext, onPageGenerated?: (page: any) => Promise<void>) {
    const successfulPages: any[] = [];

    // Pre-fetch assets to avoid N+1 queries inside the loop
    const projectAssets = await this.prisma.projectAsset.findMany({
      where: { projectId: ctx.projectId },
      select: { id: true, type: true, prompt: true }
    });

    const partnerBrandAssets = await this.prisma.asset.findMany({
      where: { projectId: ctx.projectId, purpose: 'partner_brand' },
      select: { id: true, url: true }
    });

    const combinedAssets = [
      ...projectAssets,
      ...partnerBrandAssets.map(a => {
        const match = a.url.match(/global\/brands\/([^\/]+)\/logo/);
        const brandName = match ? match[1].split('.')[0] : 'Unknown';
        return {
          id: a.id,
          type: 'PARTNER_BRAND',
          prompt: `Logo for partner brand: ${brandName}`
        };
      })
    ];

    for (const pageSlug of ctx.pagesToGenerate) {
      try {
        const existingPage = await this.prisma.page.findUnique({
          where: { projectId_slug: { projectId: ctx.projectId, slug: pageSlug } }
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

        const keywordTarget = ctx.keywordStrategyResult.pages.find((p: any) => p.slug === pageSlug);

        let seoResult = null;
        if (pageSlug !== 'layout') {
          seoResult = await this.executeWithRetries(this.seoMetadata, {
            projectId: ctx.projectId,
            context: { businessContext: ctx.businessContext, pageSlug, keywordTarget, projectAssets: combinedAssets },
            metadata: { phase: 'generation', pageSlug }
          });
        }

        const isLocationServicePage = ctx.isLocationServicePageMap.has(pageSlug);
        let serviceSlug = null;
        if (isLocationServicePage) {
          const parts = pageSlug.split('/');
          if (parts.length === 3) serviceSlug = parts[2];
        }

        let sectionTypes: string[] = [];
        if (pageSlug === 'layout') {
          sectionTypes = ['HeaderSection', 'FooterSection'];
        } else {
          const structureResult = await this.executeWithRetries(this.pageStructure, {
            projectId: ctx.projectId,
            context: { businessContext: ctx.businessContext, brandVoice: ctx.brandVoiceResult, pageSlug, isLocationServicePage },
            metadata: { phase: 'generation', pageSlug }
          });
          sectionTypes = structureResult.sections;
        }

        const generatedSections: any[] = [];
        const generatedComponents: Record<string, string> = {};

        for (const sectionType of sectionTypes) {
          const componentName = sectionType;
          
          let copyDataResult = null;
          let sectionCopy = null;
          try {
            copyDataResult = await this.executeWithRetries(this.copyWriter, {
              projectId: ctx.projectId,
              context: { 
                businessContext: ctx.businessContext, 
                brandVoice: ctx.brandVoiceResult, 
                seoMeta: seoResult, 
                sectionType, 
                pageSlug, 
                isLocationServicePage, 
                serviceSlug,
                projectAssets: combinedAssets,
                validRoutes: ctx.pagesToGenerate.filter(p => p !== 'layout')
              },
              metadata: { phase: 'generation', pageSlug, componentName }
            }, 2);

            sectionCopy = await this.executeWithRetries(this.uiDesigner, {
              projectId: ctx.projectId,
              context: { sectionType, brandIdentity: ctx.brandIdentityResult, copyData: copyDataResult, pageSlug },
              metadata: { phase: 'generation', pageSlug, componentName }
            }, 2);
          } catch (error) {
            this.logger.warn(`[${pageSlug}] Failed to generate copy or AST for section ${sectionType}: ${error.message}`);
          }
          
          let websiteData = await this.prisma.websiteData.findUnique({ where: { projectId: ctx.projectId } });
          let customComponents = (websiteData?.customComponents as Record<string, string>) || {};
          
          try {
            this.logger.log(`[${pageSlug}] Generating new component: ${componentName}`);
            const componentResult = await this.executeWithRetries(this.componentGenerator, {
              projectId: ctx.projectId,
              context: { 
                sectionType: componentName, 
                brandIdentity: ctx.brandIdentityResult,
                sampleData: copyDataResult,
                themePreference: ctx.themePreference,
                designTokens: ctx.designSystemResult,
              },
              metadata: { phase: 'generation', componentName }
            }, 2);
            
            customComponents[componentName] = componentResult.code;
            await this.prisma.websiteData.update({
              where: { projectId: ctx.projectId },
              data: { customComponents }
            });
          } catch (err) {
            this.logger.warn(`Failed to generate component ${componentName}: ${err.message}`);
          }

          if (!sectionCopy) {
            sectionCopy = this.getFallbackSection(sectionType, ctx.businessContext);
          }

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
        
        if (seoResult && seoResult.data) {
          await this.resolveImages(seoResult.data);
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

    return successfulPages;
  }

  private getFallbackSection(sectionType: string, businessContext: any): any {
    const id = `fallback-${sectionType.toLowerCase()}-${Date.now()}`;
    const base = { id, type: sectionType };
    const name = businessContext?.businessName || 'Local Pro';
    const email = businessContext?.email || 'contact@example.com';
    const phone = businessContext?.phone || '555-0100';
    const address = businessContext?.address || '123 Main St';

    switch (sectionType) {
      case 'HeroSection': return { ...base, content: { headline: `Welcome to ${name}`, subheadline: "Professional services.", eyebrow: "Top Rated", primaryCtaText: "Contact Us", primaryCtaLink: "/contact", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'PageHeaderSection': return { ...base, content: { headline: "Page Content", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'BrandsSection': return { ...base, content: { brands: [{ name: "Certified Pro", logo: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" }] } };
      case 'ServicesSection': return { ...base, content: { sectionTitle: "Our Services", sectionDescription: "Professional services built to last.", services: [{ title: "General Contracting", description: "Expert craftsmanship", link: "/services" }] } };
      case 'AboutSection': return { ...base, content: { sectionTitle: "Your Local Experts", content: `Led by professionals at ${name}.`, image: "https://images.unsplash.com/photo-1541888053-ce2073fb1155" } };
      case 'WhyUsSection': return { ...base, content: { sectionTitle: "Experience the difference", items: [{ title: "Experience", description: "Years of experience.", icon: "CheckCircle" }] } };
      case 'BeforeAfterSection': return { ...base, content: { sectionTitle: "Amazing Transformation", comparisons: [{ beforeImage: "https://images.unsplash.com/photo-1541888053-ce2073fb1155", afterImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459", title: "Kitchen Remodel" }] } };
      case 'TimelineSection': return { ...base, content: { sectionTitle: "Our Process", steps: [{ title: "Consultation", description: "Initial meeting." }] } };
      case 'TestimonialsSection': return { ...base, content: { sectionTitle: "What Our Clients Say", testimonials: [{ name: "Jane Doe", location: "Local Area", quote: "Great service!", rating: 5 }] } };
      case 'LocationsSection': return { ...base, content: { sectionTitle: "Our Service Areas", locations: [{ city: "Local City", state: "ST", description: "Serving the local area.", link: "/service-areas" }] } }; 
      case 'ServiceDetailsSection': return { ...base, content: { title: "Service overview.", content: "<p>Quality service description.</p>" } };
      case 'CallToActionSection': return { ...base, content: { headline: "Ready to start?", callToAction: { text: "Contact Us", href: "/contact" } } };
      case 'LeadFormSection': return { ...base, content: { sectionTitle: "Request a Quote", fields: [{ name: "name", type: "text", label: "Name", required: true }], submitText: "Submit" } };
      case 'GallerySection': return { ...base, content: { sectionTitle: "Our Work", images: [{ image: "https://images.unsplash.com/photo-1541888081622-17b587b1c459", caption: "Work 1" }] } };
      case 'FaqSection': return { ...base, content: { sectionTitle: "Frequently Asked Questions", faqs: [{ question: "What is your process?", answer: "We start with a consultation." }] } };
      case 'FindUsSection': return { ...base, content: { sectionTitle: "Find Us", address, phone, email, hours: "Mon-Fri 9-5" } };
      case 'PortfolioSection': return { ...base, content: { sectionTitle: "Our Recent Work", projects: [{ title: "Project 1", description: "A great project", image: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" }] } };
      case 'HeaderSection': return { ...base, content: { logoText: name, phone, navLinks: [{ label: "Home", href: "/" }], ctaText: "Contact", ctaLink: "/contact" } };
      case 'FooterSection': return { ...base, content: { companyName: name, description: "Professional services.", phone, email, address, quickLinks: [{ label: "Home", href: "/" }], copyright: new Date().getFullYear().toString() } };
      case 'ContentSection': return { ...base, content: { title: "Content", content: "<p>Rich content here.</p>" } };
      default: return { ...base, content: {} };
    }
  }

  private async resolveImages(obj: any, seen = new Set<any>()): Promise<void> {
    if (!obj || typeof obj !== 'object') return;
    if (seen.has(obj)) return;
    seen.add(obj);

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        if (val.startsWith('UNSPLASH:')) {
          const query = val.replace('UNSPLASH:', '').trim();
          const url = await this.unsplash.searchImage(query);
          if (url) {
            obj[key] = url;
          } else {
            // Transparent 1x1 pixel to prevent broken image icons
            obj[key] = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          }
        } else if (val.startsWith('ASSET:')) {
          const assetId = val.replace('ASSET:', '').trim();
          const asset = await this.prisma.projectAsset.findUnique({ where: { id: assetId } });
          if (asset && asset.status === 'completed' && asset.webpUrl) {
            obj[key] = asset.webpUrl;
          } else {
            obj[key] = `/api/assets/${assetId}`;
          }
        }
      } else if (typeof val === 'object') {
        await this.resolveImages(val, seen);
      }
    }
  }
}
