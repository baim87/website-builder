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

    // 3. Map to SiteContent
    const siteContent = this.mapToSiteContent(businessContext, websiteData, pages, assets);

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
  private mapToSiteContent(businessContext: any, websiteData: any, pages: any[], assets: any[]): any {
    const logoAsset = assets.find(a => a.purpose === 'logo' || a.type === 'image');
    
    const seoData = websiteData.seoMetadata || {};
    const tokens = websiteData.designTokens || {};

    return {
      business: {
        name: businessContext.businessName || "Contractor Pro",
        tagline: seoData.title || `${businessContext.trade} Experts`,
        phone: businessContext.phone || "(555) 123-4567",
        email: businessContext.email || "contact@example.com",
        address: businessContext.businessAddress || "123 Main St, Anytown USA",
        logoUrl: logoAsset?.url || ""
      },
      seo: {
        title: seoData.title || businessContext.businessName,
        description: seoData.description || `Expert ${businessContext.trade} services.`,
      },
      theme: {
        primary: tokens.colors?.primary || "#2563eb",
        secondary: tokens.colors?.secondary || "#1e40af",
        accent: tokens.colors?.accent || "#f59e0b",
        fontFamily: tokens.typography?.headingFont || "Inter"
      },
      pages: pages.map(p => p.content),
      // Optional: keep global lists if needed for navigation/footers
      services: businessContext.services?.map((s: string) => ({
        slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        name: s,
        description: `Professional ${s} services for your home or business.`,
        icon: "Wrench",
        image: "https://images.unsplash.com/photo-1504307651254-35680f356f58?q=80&w=2070&auto=format&fit=crop"
      })) || [
        {
          slug: "residential-services",
          name: "Residential Services",
          description: "Complete residential services for your home.",
          icon: "Home",
          image: "https://images.unsplash.com/photo-1504307651254-35680f356f58?q=80&w=2070&auto=format&fit=crop"
        }
      ],
      locations: businessContext.serviceAreas?.map((area: string) => ({
        slug: area.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        name: area,
        description: `Proudly serving ${area} and surrounding communities.`,
        image: "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=2070&auto=format&fit=crop"
      })) || [],
      portfolio: [],
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
      beforeAfter: [],
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
