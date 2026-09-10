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

import { ImagePlannerSkill } from './impl/image-planner.skill';
import { ImageGenerationProducer } from '../queue/producers/image-generation.producer';
import { PartnerBrandService } from '../assets/partner-brand.service';
import { ServiceRankingService } from '../keywords/service-ranking.service';
import { SeasonalityService } from '../keywords/seasonality.service';

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

    // Merge cities from locationMetrics and businessContext.serviceAreas
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

    // --- PHASE 0: Pre-Generation Intelligence (Ranking & Seasonality) ---
    this.logger.log('Phase 0: Pre-Generation Intelligence');
    
    // Create WebsiteData early if it doesn't exist to store config
    let existingWebsiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
    if (!existingWebsiteData) {
      existingWebsiteData = await this.prisma.websiteData.create({ data: { projectId } });
    }

    const servicesList = Array.isArray(businessContext.services) 
      ? businessContext.services.map((s: any) => typeof s === 'string' ? s : (s.name || s.title || 'Service'))
      : [];
      
    // Execute Ranking
    await this.serviceRankingService.rankServices(
      projectId,
      servicesList,
      businessContext.location || 'Unknown City',
      businessContext.county,
      businessContext.state
    );
    
    // Execute Seasonality
    const seasonalConfig = { announcementBar: await this.seasonalityService.generateSeasonalConfig(projectId) };
    
    // Store in DB
    const serviceKeywordMetrics = await this.prisma.serviceKeywordMetrics.findMany({
      where: { projectId },
      orderBy: { rank: 'asc' }
    });
    
    await this.prisma.websiteData.update({
      where: { projectId },
      data: { 
        serviceRanking: serviceKeywordMetrics as any,
        seasonalConfig: seasonalConfig as any 
      },
    });
    
    // Inject into context for later skills
    businessContext.seasonalConfig = seasonalConfig;
    businessContext.serviceRanking = serviceKeywordMetrics;

    // --- PHASE 1: Brand & Design System ---
    this.logger.log('Phase 1: Brand & Design System');
    const themePreference = businessContext.brandIdentityInputs?.themePreference || 'modern-minimalist';
    const phase1Input = { projectId, context: { businessContext, themePreference }, metadata: { phase: 'generation' } };
    
    // existingWebsiteData was already fetched in Phase 0
    
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
        context: { businessContext, brandIdentity: brandIdentityResult, themePreference },
        metadata: { phase: 'generation' }
      });

      globalCssResult = await this.executeWithRetries(this.cssStyle, {
        projectId,
        context: { designSystem: designSystemResult, themePreference },
        metadata: { phase: 'generation' }
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
    this.logger.log('Phase 2: Keyword Strategy & Asset Planning');
    let keywordStrategyResult = existingWebsiteData?.seoMetadata as any;
    
    if (!keywordStrategyResult || !keywordStrategyResult.pages) {
        keywordStrategyResult = await this.executeWithRetries(this.keywordStrategy, {
          projectId,
          context: { businessContext, pages: pagesToGenerate.filter(p => p !== 'layout') },
          metadata: { phase: 'generation' }
        });
        await this.prisma.websiteData.update({
            where: { projectId },
            data: { seoMetadata: keywordStrategyResult, generationStatus: 'pages' }
        });
    } else {
        this.logger.log('Skipping Phase 2 - Keyword Strategy already exists');
    }

    // --- PHASE 2.25: Partner Brands ---
    this.logger.log('Phase 2.25: Extracting and Caching Partner Brands');
    const existingBrands = await this.prisma.asset.count({ where: { projectId, purpose: 'partner_brand' } });
    if (existingBrands === 0 && businessContext.trade) {
      await this.partnerBrandService.processPartnerBrands(projectId, businessContext.trade, businessContext.services || []);
    }

    // --- PHASE 2.5: Image Planning & Queueing ---
    this.logger.log('Phase 2.5: Image Planning & Generation Setup');
    const existingAssets = await this.prisma.projectAsset.count({ where: { projectId } });
    if (existingAssets === 0) {
      const imagePlanResult = await this.executeWithRetries(this.imagePlanner, {
        projectId,
        context: { businessContext, pagesToGenerate },
        metadata: { phase: 'generation' }
      });
      
      const { assets } = imagePlanResult;
      this.logger.log(`Queueing ${assets.length} images for generation...`);
      for (const asset of assets) {
        // userId isn't strictly available here easily unless we fetch it from the project, let's fetch it:
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (project) {
          await this.imageGenerationProducer.generateImage(projectId, project.userId, asset.id);
        }
      }
    } else {
      this.logger.log('Skipping Image Planning - Assets already planned');
    }

    // --- PHASE 2.75: Blocking Wait for Images ---
    this.logger.log('Phase 2.75: Waiting for all planned images to finish generating before proceeding...');
    let allImagesCompleted = false;
    let waitLoopCount = 0;
    while (!allImagesCompleted) {
      const [pendingAssets, completedAssets, failedAssets, totalAssets] = await Promise.all([
        this.prisma.projectAsset.count({ where: { projectId, status: { in: ['pending', 'generating'] } } }),
        this.prisma.projectAsset.count({ where: { projectId, status: 'completed' } }),
        this.prisma.projectAsset.count({ where: { projectId, status: 'failed' } }),
        this.prisma.projectAsset.count({ where: { projectId } }),
      ]);
      
      if (pendingAssets === 0) {
        allImagesCompleted = true;
        this.logger.log(`✓ All images complete! ${completedAssets} succeeded, ${failedAssets} failed out of ${totalAssets} total.`);
      } else {
        // Log progress every 15 seconds (every 3rd iteration of the 5s loop)
        if (waitLoopCount % 3 === 0) {
          this.logger.log(`⏳ Image progress: ${completedAssets}/${totalAssets} done, ${pendingAssets} remaining, ${failedAssets} failed. Waiting...`);
        }
        waitLoopCount++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
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

        // Fetch available project assets to use in copy generation and SEO
        const projectAssets = await this.prisma.projectAsset.findMany({
          where: { projectId },
          select: { id: true, type: true, prompt: true }
        });

        const partnerBrandAssets = await this.prisma.asset.findMany({
          where: { projectId, purpose: 'partner_brand' },
          select: { id: true, url: true }
        });

        const combinedAssets = [
          ...projectAssets,
          ...partnerBrandAssets.map(a => {
            // Extract domain from global/brands/domain.com/logo.png if possible
            const match = a.url.match(/global\/brands\/([^\/]+)\/logo/);
            const brandName = match ? match[1].split('.')[0] : 'Unknown';
            return {
              id: a.id,
              type: 'PARTNER_BRAND',
              prompt: `Logo for partner brand: ${brandName}`
            };
          })
        ];

        // Phase 3: SEO Metadata
        let seoResult = null;
        if (pageSlug !== 'layout') {
          seoResult = await this.executeWithRetries(this.seoMetadata, {
            projectId,
            context: { businessContext, pageSlug, keywordTarget, projectAssets: combinedAssets },
            metadata: { phase: 'generation', pageSlug }
          });
        }

        // Phase 4a: Page Structure
        const isLocationServicePage = isLocationServicePageMap.has(pageSlug);
        let serviceSlug = null;
        if (isLocationServicePage) {
          const parts = pageSlug.split('/');
          if (parts.length === 3) serviceSlug = parts[2]; // service-areas/[city]/[service]
        }

        let sectionTypes: string[] = [];
        if (pageSlug === 'layout') {
          sectionTypes = ['HeaderSection', 'FooterSection'];
        } else {
          const structureResult = await this.executeWithRetries(this.pageStructure, {
            projectId,
            context: { businessContext, brandVoice: brandVoiceResult, pageSlug, isLocationServicePage },
            metadata: { phase: 'generation', pageSlug }
          });
          sectionTypes = structureResult.sections;
        }

        const generatedSections: any[] = [];
        const generatedComponents: Record<string, string> = {};

        // Phase 4b & 5: Copy and Component Code
        for (const sectionType of sectionTypes) {
          const componentName = sectionType; // e.g. "HeroSection"
          
          let copyDataResult = null;
          let sectionCopy = null;
          try {
            // 1. Generate Raw Copy
            copyDataResult = await this.executeWithRetries(this.copyWriter, {
              projectId,
              context: { 
                businessContext, 
                brandVoice: brandVoiceResult, 
                seoMeta: seoResult, 
                sectionType, 
                pageSlug, 
                isLocationServicePage, 
                serviceSlug,
                projectAssets: combinedAssets,
                validRoutes: pagesToGenerate.filter(p => p !== 'layout')
              },
              metadata: { phase: 'generation', pageSlug, componentName }
            }, 2);

            // 2. Generate UI AST Layout
            sectionCopy = await this.executeWithRetries(this.uiDesigner, {
              projectId,
              context: { sectionType, brandIdentity: brandIdentityResult, copyData: copyDataResult, pageSlug },
              metadata: { phase: 'generation', pageSlug, componentName }
            }, 2);
          } catch (error) {
            this.logger.warn(`[${pageSlug}] Failed to generate copy or AST for section ${sectionType}: ${error.message}`);
          }
          
          // Generate the reusable .tsx component
          let websiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
          let customComponents = (websiteData?.customComponents as Record<string, string>) || {};
          
          try {
            this.logger.log(`[${pageSlug}] Generating new component: ${componentName}`);
            const componentResult = await this.executeWithRetries(this.componentGenerator, {
              projectId,
              context: { 
                sectionType: componentName, 
                brandIdentity: brandIdentityResult,
                sampleData: copyDataResult,
                themePreference,
                designTokens: designSystemResult,
              },
              metadata: { phase: 'generation', componentName }
            }, 2);
            
            customComponents[componentName] = componentResult.code;
            await this.prisma.websiteData.update({
              where: { projectId },
              data: { customComponents }
            });
          } catch (err) {
            this.logger.warn(`Failed to generate component ${componentName}: ${err.message}`);
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
        
        // Resolve images in SEO metadata
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
      case 'HeroSection': return { ...base, content: { headline: "Welcome", subheadline: "Professional services.", eyebrow: "Top Rated", primaryCtaText: "Contact Us", primaryCtaLink: "/contact", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'PageHeaderSection': return { ...base, content: { headline: "Page Content", backgroundImage: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" } };
      case 'BrandsSection': return { ...base, content: { brands: [{ name: "Certified Pro", logo: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" }] } };
      case 'ServicesSection': return { ...base, content: { sectionTitle: "Our Services", sectionDescription: "Professional services built to last.", services: [{ title: "General Contracting", description: "Expert craftsmanship", link: "/services" }] } };
      case 'AboutSection': return { ...base, content: { sectionTitle: "Your Local Experts", content: "Led by John Doe, we are professionals.", image: "https://images.unsplash.com/photo-1541888053-ce2073fb1155" } };
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
      case 'FindUsSection': return { ...base, content: { sectionTitle: "Find Us", address: "123 Main St", phone: "555-0100", email: "info@example.com", hours: "Mon-Fri 9-5" } };
      case 'PortfolioSection': return { ...base, content: { sectionTitle: "Our Recent Work", projects: [{ title: "Project 1", description: "A great project", image: "https://images.unsplash.com/photo-1541888081622-17b587b1c459" }] } };
      case 'HeaderSection': return { ...base, content: { logoText: "Logo", phone: "555-0100", navLinks: [{ label: "Home", href: "/" }], ctaText: "Contact", ctaLink: "/contact" } };
      case 'FooterSection': return { ...base, content: { companyName: "Company", description: "Professional services.", phone: "555-0100", email: "info@example.com", address: "123 Main St", quickLinks: [{ label: "Home", href: "/" }], copyright: "2026" } };
      case 'ContentSection': return { ...base, content: { title: "Content", content: "<p>Rich content here.</p>" } };
      default: return { ...base, content: {} };
    }
  }

  private async resolveImages(obj: any): Promise<void> {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        if (val.startsWith('UNSPLASH:')) {
          const query = val.replace('UNSPLASH:', '').trim();
          const url = await this.unsplash.searchImage(query);
          if (url) {
            obj[key] = url;
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
        await this.resolveImages(val);
      }
    }
  }
}
