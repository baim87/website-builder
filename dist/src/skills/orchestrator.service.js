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
var OrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const skill_executor_service_1 = require("./skill-executor.service");
const brand_voice_skill_1 = require("./impl/brand-voice.skill");
const brand_identity_skill_1 = require("./impl/brand-identity.skill");
const design_system_skill_1 = require("./impl/design-system.skill");
const page_structure_skill_1 = require("./impl/page-structure.skill");
const seo_metadata_skill_1 = require("./impl/seo-metadata.skill");
const keyword_strategy_skill_1 = require("./impl/keyword-strategy.skill");
const css_style_skill_1 = require("./impl/css-style.skill");
const copy_writer_skill_1 = require("./impl/copy-writer.skill");
const ui_designer_skill_1 = require("./impl/ui-designer.skill");
const prisma_service_1 = require("../prisma/prisma.service");
const unsplash_service_1 = require("../images/unsplash.service");
let OrchestratorService = OrchestratorService_1 = class OrchestratorService {
    executor;
    brandVoice;
    brandIdentity;
    designSystem;
    pageStructure;
    seoMetadata;
    keywordStrategy;
    cssStyle;
    copyWriter;
    uiDesigner;
    prisma;
    unsplash;
    logger = new common_1.Logger(OrchestratorService_1.name);
    constructor(executor, brandVoice, brandIdentity, designSystem, pageStructure, seoMetadata, keywordStrategy, cssStyle, copyWriter, uiDesigner, prisma, unsplash) {
        this.executor = executor;
        this.brandVoice = brandVoice;
        this.brandIdentity = brandIdentity;
        this.designSystem = designSystem;
        this.pageStructure = pageStructure;
        this.seoMetadata = seoMetadata;
        this.keywordStrategy = keywordStrategy;
        this.cssStyle = cssStyle;
        this.copyWriter = copyWriter;
        this.uiDesigner = uiDesigner;
        this.prisma = prisma;
        this.unsplash = unsplash;
    }
    async executeWithRetries(skill, input, retries = 3) {
        let attempt = 1;
        while (attempt <= retries) {
            try {
                return await this.executor.executeSkill(skill, input);
            }
            catch (error) {
                this.logger.warn(`Skill ${skill.name} failed on attempt ${attempt}: ${error.message}`);
                if (attempt === retries)
                    throw error;
                attempt++;
            }
        }
    }
    async generateWebsite(projectId, businessContext, onPageGenerated) {
        this.logger.log(`Starting 6-phase generation pipeline for project ${projectId}`);
        const pagesToGenerate = ['home', 'about-us', 'services', 'service-areas', 'portfolio', 'contact'];
        const serviceSlugs = [];
        if (businessContext.services && Array.isArray(businessContext.services)) {
            businessContext.services.forEach((service) => {
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
        const isLocationServicePageMap = new Set();
        if (locationMetrics.length > 0 && serviceSlugs.length > 0) {
            locationMetrics.forEach(metric => {
                const citySlug = metric.city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                serviceSlugs.forEach(serviceSlug => {
                    const nestedSlug = `${citySlug}/${serviceSlug}`;
                    pagesToGenerate.push(nestedSlug);
                    isLocationServicePageMap.add(nestedSlug);
                });
            });
        }
        else if (businessContext.serviceAreas && Array.isArray(businessContext.serviceAreas)) {
            businessContext.serviceAreas.forEach((area) => {
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
        this.logger.log('Phase 1: Brand & Design System');
        const phase1Input = { projectId, context: { businessContext } };
        const [brandIdentitySettled, brandVoiceSettled] = await Promise.allSettled([
            this.executeWithRetries(this.brandIdentity, phase1Input),
            this.executeWithRetries(this.brandVoice, phase1Input),
        ]);
        if (brandIdentitySettled.status === 'rejected')
            throw brandIdentitySettled.reason;
        if (brandVoiceSettled.status === 'rejected')
            throw brandVoiceSettled.reason;
        const brandIdentityResult = brandIdentitySettled.value;
        const brandVoiceResult = brandVoiceSettled.value;
        const designSystemResult = await this.executeWithRetries(this.designSystem, {
            projectId,
            context: { businessContext, brandIdentity: brandIdentityResult }
        });
        const globalCssResult = await this.executeWithRetries(this.cssStyle, {
            projectId,
            context: { designSystem: designSystemResult }
        });
        this.logger.log('Phase 2: Keyword Strategy');
        const keywordStrategyResult = await this.executeWithRetries(this.keywordStrategy, {
            projectId,
            context: { businessContext, pages: pagesToGenerate }
        });
        const successfulPages = [];
        for (const pageSlug of pagesToGenerate) {
            try {
                this.logger.log(`\n[${pageSlug}] Starting Generation Loop`);
                const keywordTarget = keywordStrategyResult.pages.find((p) => p.slug === pageSlug);
                const seoResult = await this.executeWithRetries(this.seoMetadata, {
                    projectId,
                    context: { businessContext, pageSlug, keywordTarget }
                });
                const isLocationServicePage = isLocationServicePageMap.has(pageSlug);
                let serviceSlug = null;
                if (isLocationServicePage) {
                    const parts = pageSlug.split('/');
                    if (parts.length === 2)
                        serviceSlug = parts[1];
                }
                const structureResult = await this.executeWithRetries(this.pageStructure, {
                    projectId,
                    context: { businessContext, brandVoice: brandVoiceResult, pageSlug, isLocationServicePage }
                });
                const sectionTypes = structureResult.sections;
                const generatedSections = [];
                const generatedComponents = {};
                for (const sectionType of sectionTypes) {
                    let sectionCopy = null;
                    try {
                        const copyDataResult = await this.executeWithRetries(this.copyWriter, {
                            projectId,
                            context: { businessContext, brandVoice: brandVoiceResult, seoMeta: seoResult, sectionType, pageSlug, isLocationServicePage, serviceSlug }
                        }, 2);
                        sectionCopy = await this.executeWithRetries(this.uiDesigner, {
                            projectId,
                            context: { sectionType, brandIdentity: brandIdentityResult, copyData: copyDataResult, pageSlug }
                        }, 2);
                    }
                    catch (error) {
                        this.logger.warn(`[${pageSlug}] Failed to generate section ${sectionType}: ${error.message}`);
                    }
                    if (!sectionCopy) {
                        sectionCopy = this.getFallbackSection(sectionType);
                    }
                    if (sectionCopy && sectionCopy.content) {
                        await this.resolveImages(sectionCopy.content);
                    }
                    generatedSections.push(sectionCopy);
                }
                const pagePayload = {
                    slug: pageSlug,
                    sections: generatedSections,
                    componentCode: Object.keys(generatedComponents).length > 0 ? generatedComponents : null,
                    seoMeta: seoResult,
                    keywordTarget,
                };
                successfulPages.push(pagePayload);
                if (onPageGenerated) {
                    try {
                        await onPageGenerated(pagePayload);
                    }
                    catch (err) {
                        this.logger.error(`[${pageSlug}] Failed to execute onPageGenerated callback: ${err.message}`);
                    }
                }
            }
            catch (error) {
                this.logger.error(`Failed to generate page ${pageSlug}: ${error.message}`);
            }
        }
        return {
            designTokens: designSystemResult,
            globalCss: globalCssResult,
            brandVoice: brandVoiceResult,
            keywordStrategy: keywordStrategyResult,
            pages: successfulPages,
        };
    }
    getFallbackSection(sectionType) {
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
    async resolveImages(obj) {
        if (!obj || typeof obj !== 'object')
            return;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string' && val.startsWith('UNSPLASH:')) {
                const query = val.replace('UNSPLASH:', '').trim();
                const url = await this.unsplash.searchImage(query);
                if (url) {
                    obj[key] = url;
                }
            }
            else if (typeof val === 'object') {
                await this.resolveImages(val);
            }
        }
    }
};
exports.OrchestratorService = OrchestratorService;
exports.OrchestratorService = OrchestratorService = OrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [skill_executor_service_1.SkillExecutorService,
        brand_voice_skill_1.BrandVoiceSkill,
        brand_identity_skill_1.BrandIdentitySkill,
        design_system_skill_1.DesignSystemSkill,
        page_structure_skill_1.PageStructureSkill,
        seo_metadata_skill_1.SeoMetadataSkill,
        keyword_strategy_skill_1.KeywordStrategySkill,
        css_style_skill_1.CSSStyleSkill,
        copy_writer_skill_1.CopyWriterSkill,
        ui_designer_skill_1.UIDesignerSkill,
        prisma_service_1.PrismaService,
        unsplash_service_1.UnsplashService])
], OrchestratorService);
//# sourceMappingURL=orchestrator.service.js.map