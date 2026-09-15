import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class SiteContentService {
  private readonly logger = new Logger(SiteContentService.name);
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteDataService: WebsiteDataService,
    private readonly businessContextService: BusinessContextService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generates or fetches the cached SiteContent payload for a project
   */
  async getSiteContent(projectId: string, userId?: string, bypassCache = false): Promise<any> {
    const cacheKey = `site-content:${projectId}`;

    // 1. Check Redis Cache
    if (!bypassCache) {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    this.logger.log(`Building fresh site content for ${projectId}`);

    // 2. Fetch raw entities
    const websiteData = await this.websiteDataService.findByProjectId(projectId, userId);
    const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
    const pages = await this.prisma.page.findMany({ where: { projectId } });
    const assets = await this.prisma.asset.findMany({ where: { projectId } });
    const projectAssets = await this.prisma.projectAsset.findMany({ 
      where: { projectId, status: 'completed' } 
    });
    const siteAnalytics = await this.prisma.siteAnalytics.findUnique({
      where: { projectId }
    });

    // 3. Map to SiteContent
    const siteContent = this.mapToSiteContent(businessContext, websiteData, pages, assets, projectAssets, siteAnalytics);

    // 4. Update Redis Cache
    await this.redisService.set(cacheKey, siteContent, this.CACHE_TTL_SECONDS);

    return siteContent;
  }

  /**
   * Invalidates the cache for a specific project
   */
  async invalidateCache(projectId: string): Promise<void> {
    const cacheKey = `site-content:${projectId}`;
    await this.redisService.del(cacheKey);
    this.logger.log(`Invalidated cache for ${cacheKey}`);
  }

  /**
   * Maps backend entities to the frontend SiteContent interface
   */
  private mapToSiteContent(businessContext: any, websiteData: any, pages: any[], assets: any[], projectAssets: any[] = [], siteAnalytics: any = null): any {
    const metaData = businessContext.interviewMetadata || {};
    let finalLogoUrl = metaData.finalLogoUrl;
    if (!finalLogoUrl) {
      finalLogoUrl = assets.find(a => a.purpose === 'logo')?.url || '';
    }
    
    let finalPortraitUrl = metaData.finalPortraitUrl;
    if (!finalPortraitUrl) {
      finalPortraitUrl = assets.find(a => a.purpose === 'portrait')?.url || '';
    }

    let finalFaviconUrl = metaData.finalFaviconUrl;
    if (!finalFaviconUrl) {
      finalFaviconUrl = assets.find(a => a.purpose === 'favicon')?.url || '';
    }
    
    const seoData = websiteData.seoMetadata || {};
    const tokens = websiteData.designTokens || {};

    const portfolio = projectAssets
      .filter(pa => pa.type === 'GALLERY' && (pa.webpUrl || pa.originalUrl))
      .map(pa => ({
        title: pa.metadata?.service || "Project Gallery",
        slug: pa.id,
        category: pa.metadata?.service || "Gallery",
        image: pa.webpUrl || pa.originalUrl
      }));

    const beforeAfter = projectAssets
      .filter(pa => pa.type === 'AFTER' && (pa.webpUrl || pa.originalUrl) && pa.referenceAssetId)
      .map(afterAsset => {
        const beforeAsset = projectAssets.find(pa => pa.id === afterAsset.referenceAssetId && (pa.webpUrl || pa.originalUrl));
        if (beforeAsset) {
          return {
            beforeImage: beforeAsset.webpUrl || beforeAsset.originalUrl,
            afterImage: afterAsset.webpUrl || afterAsset.originalUrl,
            title: afterAsset.metadata?.service || "Project Completion"
          };
        }
        return null;
      })
      .filter(Boolean);

    const heroImages = projectAssets
      .filter(pa => pa.type === 'HERO' && (pa.webpUrl || pa.originalUrl))
      .map(pa => pa.webpUrl || pa.originalUrl);
    
    let heroImageIndex = 0;

    const layoutPage = pages.find(p => p.slug === 'layout');
    const headerSection = Array.isArray(layoutPage?.content) ? layoutPage.content.find((s: any) => s.type === 'HeaderSection') : null;
    const footerSection = Array.isArray(layoutPage?.content) ? layoutPage.content.find((s: any) => s.type === 'FooterSection') : null;
    const announcementBarSection = Array.isArray(layoutPage?.content) ? layoutPage.content.find((s: any) => s.type === 'AnnouncementBarSection') : null;

    return {
      designTokens: tokens,
      seoMetadata: seoData,
      layout: {
        header: headerSection || null,
        footer: footerSection || null,
        announcementBar: announcementBarSection || null,
      },
      business: {
        name: businessContext.businessName || "Contractor Pro",
        tagline: seoData.title || `${businessContext.trade} Experts`,
        phone: businessContext.phone || "(555) 123-4567",
        email: businessContext.email || "contact@example.com",
        address: businessContext.businessAddress || "123 Main St, Anytown USA",
        logoUrl: finalLogoUrl,
        faviconUrl: finalFaviconUrl,
        contactPhotoUrl: finalPortraitUrl
      },
      seo: {
        title: seoData.title || businessContext.businessName,
        description: seoData.description || `Expert ${businessContext.trade} services.`,
        jsonLd: websiteData.jsonLdSchemas || null,
        gtmId: siteAnalytics?.gtmContainerId || process.env.GOOGLE_TAG_MANAGER_CONTAINER_ID || null,
      },
      theme: {
        primary: tokens.colors?.primary || "#2563eb",
        secondary: tokens.colors?.secondary || "#1e40af",
        accent: tokens.colors?.accent || "#f59e0b",
        fontFamily: tokens.typography?.headingFont || "Inter"
      },
      pages: pages.filter(p => p.slug !== 'layout').map(p => {
        let sections = p.content;
        if (Array.isArray(sections)) {
          const partnerBrands = assets.filter(a => a.purpose === 'partner_brand');
          
          sections = sections.map((s: any) => {
            // Determine where the data lives (AST format vs legacy content format)
            const hasAst = !!(s.ast && s.ast.props && s.ast.props.data);
            const dataTarget = hasAst ? { ...s.ast.props.data } : { ...(s.content || {}) };
            let modified = false;

            // Inject Portrait Asset into AboutSection
            if ((s.id === 'about' || s.type === 'AboutSection') && finalPortraitUrl) {
              dataTarget.image = finalPortraitUrl;
              modified = true;
            }
            
            // Inject Partner Brands into BrandsSection
            if (s.type === 'BrandsSection' && partnerBrands.length > 0) {
              dataTarget.brands = partnerBrands.map(b => ({
                name: b.section || 'Partner Brand',
                logo: b.url
              }));
              modified = true;
            }

            // Inject Hero/PageHeader images
            if (s.type === 'HeroSection' || s.type === 'PageHeader') {
              const bgImage = heroImages[heroImageIndex] || portfolio[heroImageIndex]?.image;
              if (bgImage) {
                heroImageIndex++;
                dataTarget.backgroundImage = bgImage;
                dataTarget.image = bgImage;
                modified = true;
              }
            }
            
            if (modified) {
              if (hasAst) {
                return { ...s, ast: { ...s.ast, props: { ...s.ast.props, data: dataTarget } } };
              } else {
                return { ...s, content: dataTarget };
              }
            }

            return s;
          });
        }
        return { 
          slug: p.slug, 
          sections,
          ...(p.componentCode ? { componentCode: p.componentCode } : {})
        };
      }),
      // Optional: keep global lists if needed for navigation/footers
      services: (businessContext.services || []).map((s: any) => {
        const name = typeof s === 'string' ? s : (s?.name || s?.title || String(s));
        return {
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          name: name,
          description: `Professional ${name} services for your home or business.`,
          icon: "Wrench",
          image: "https://images.unsplash.com/photo-1504307651254-35680f356f58?q=80&w=2070&auto=format&fit=crop"
        };
      }),
      locations: (businessContext.serviceAreas || []).map((area: any) => {
        const name = typeof area === 'string' ? area : (area?.name || String(area));
        return {
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          name: name,
          description: `Proudly serving ${name} and surrounding communities.`,
          image: "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=2070&auto=format&fit=crop"
        };
      }),
      portfolio,
      whyUs: [
        {
          title: "Expert Team",
          description: "Years of experience in the field.",
          icon: "Users"
        }
      ],
      testimonials: [
        {
          name: "John Smith",
          text: "Excellent work, finished on time and on budget.",
          rating: 5
        }
      ],
      beforeAfter,
      timeline: [],
      cta: {
        heading: "Ready to get started?",
        subheading: "Contact us today for a free estimate.",
        buttonText: "Request Quote"
      },

      copy: {
        nav: { services: "Services", portfolio: "Portfolio", locations: "Service Areas", about: "About Us", contact: "Contact" },
        hero: { badge: "Trusted Local Experts", reviews: "5-Star Rated" },
        brands: { tagline: "Trusted by the best" },
        about: { tagline: "Our Story", title: "About Us", contact: "Contact Us", missionLabel: "Our Mission" },
        services: { tagline: "What We Do", title: "Our Services", description: "Professional services built to last.", link: "Learn More", bullets: ["Expert craftsmanship", "Premium materials"] },
        whyUs: { tagline: "Why Choose Us", title: "The Best Choice", description: "We deliver excellence." },
        beforeAfter: { tagline: "Our Work", title: "Before & After" },
        timeline: { tagline: "Our Process", title: "How It Works", description: "Simple and transparent." },
        locations: { tagline: "Service Areas", title: "Where We Work", link: "View Area" },
        testimonials: { tagline: "Reviews", title: "What Clients Say", description: "Don't just take our word for it." },
        portfolio: { tagline: "Gallery", title: "Our Projects", description: "See our latest work." },
        contact: { tagline: "Get In Touch", title: "Contact Us", description: "Ready to start?", formTitle: "Send a Message", formButton: "Send" }
      }
    };
  }
}
