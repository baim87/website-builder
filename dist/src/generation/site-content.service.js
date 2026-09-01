"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SiteContentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteContentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const website_data_service_1 = require("../projects/website-data.service");
const business_context_service_1 = require("../projects/business-context.service");
const redis_service_1 = require("../common/redis/redis.service");
let SiteContentService = SiteContentService_1 = class SiteContentService {
    prisma;
    websiteDataService;
    businessContextService;
    redisService;
    logger = new common_1.Logger(SiteContentService_1.name);
    CACHE_TTL_SECONDS = 3600;
    constructor(prisma, websiteDataService, businessContextService, redisService) {
        this.prisma = prisma;
        this.websiteDataService = websiteDataService;
        this.businessContextService = businessContextService;
        this.redisService = redisService;
    }
    async getSiteContent(projectId, userId, bypassCache = false) {
        const cacheKey = `site-content:${projectId}`;
        if (!bypassCache) {
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
                this.logger.debug(`Cache hit for ${cacheKey}`);
                return cached;
            }
        }
        this.logger.log(`Building fresh site content for ${projectId}`);
        const websiteData = await this.websiteDataService.findByProjectId(projectId, userId);
        const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
        const pages = await this.prisma.page.findMany({ where: { projectId } });
        const assets = await this.prisma.asset.findMany({ where: { projectId } });
        const siteContent = this.mapToSiteContent(businessContext, websiteData, pages, assets);
        await this.redisService.set(cacheKey, siteContent, this.CACHE_TTL_SECONDS);
        return siteContent;
    }
    async invalidateCache(projectId) {
        const cacheKey = `site-content:${projectId}`;
        await this.redisService.del(cacheKey);
        this.logger.log(`Invalidated cache for ${cacheKey}`);
    }
    mapToSiteContent(businessContext, websiteData, pages, assets) {
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
            services: businessContext.services?.map((s) => ({
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
            locations: businessContext.serviceAreas?.map((area) => ({
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
};
exports.SiteContentService = SiteContentService;
exports.SiteContentService = SiteContentService = SiteContentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        website_data_service_1.WebsiteDataService,
        business_context_service_1.BusinessContextService,
        redis_service_1.RedisService])
], SiteContentService);
//# sourceMappingURL=site-content.service.js.map