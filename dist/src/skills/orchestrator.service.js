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
const section_content_skill_1 = require("./impl/section-content.skill");
const seo_metadata_skill_1 = require("./impl/seo-metadata.skill");
let OrchestratorService = OrchestratorService_1 = class OrchestratorService {
    executor;
    brandVoice;
    brandIdentity;
    designSystem;
    pageStructure;
    sectionContent;
    seoMetadata;
    logger = new common_1.Logger(OrchestratorService_1.name);
    constructor(executor, brandVoice, brandIdentity, designSystem, pageStructure, sectionContent, seoMetadata) {
        this.executor = executor;
        this.brandVoice = brandVoice;
        this.brandIdentity = brandIdentity;
        this.designSystem = designSystem;
        this.pageStructure = pageStructure;
        this.sectionContent = sectionContent;
        this.seoMetadata = seoMetadata;
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
        this.logger.log(`Starting 3-phase generation pipeline for project ${projectId}`);
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
        const phase2Input = {
            projectId,
            context: {
                businessContext,
                brandIdentity: brandIdentityResult,
            }
        };
        const designSystemResult = await this.executeWithRetries(this.designSystem, phase2Input);
        const phase3Input = {
            projectId,
            context: {
                businessContext,
                brandVoice: brandVoiceResult,
                designSystem: designSystemResult,
            }
        };
        const seoPromise = this.executeWithRetries(this.seoMetadata, phase3Input);
        const pagesToGenerate = ['home', 'about-us', 'services', 'service-areas', 'portfolio', 'contact'];
        if (businessContext.services && Array.isArray(businessContext.services)) {
            businessContext.services.forEach((service) => {
                const slug = typeof service === 'string'
                    ? service.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    : service.slug;
                if (slug)
                    pagesToGenerate.push(`services/${slug}`);
            });
        }
        if (businessContext.serviceAreas && Array.isArray(businessContext.serviceAreas)) {
            businessContext.serviceAreas.forEach((area) => {
                const slug = typeof area === 'string'
                    ? area.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    : area.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (slug)
                    pagesToGenerate.push(`service-areas/${slug}`);
            });
        }
        this.logger.log(`Generating ${pagesToGenerate.length} pages: ${pagesToGenerate.join(', ')}`);
        const successfulPages = [];
        for (const pageSlug of pagesToGenerate) {
            try {
                this.logger.log(`[${pageSlug}] Starting page generation...`);
                const structureResult = await this.executeWithRetries(this.pageStructure, {
                    projectId,
                    context: { ...phase3Input.context, pageSlug }
                });
                const sectionTypes = structureResult.sections;
                this.logger.log(`[${pageSlug}] Structure determined: ${sectionTypes.join(', ')}`);
                const generatedSections = [];
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
                            }, 1);
                            sectionData = result;
                        }
                        catch (error) {
                            this.logger.warn(`[${pageSlug}] Failed to generate ${sectionType} on attempt ${attempt}: ${error.message}`);
                            attempt++;
                        }
                    }
                    if (sectionData) {
                        generatedSections.push(sectionData);
                    }
                    else {
                        this.logger.error(`[${pageSlug}] Exhausted retries for ${sectionType}. Using fallback.`);
                        generatedSections.push(this.getFallbackSection(sectionType));
                    }
                }
                const pagePayload = {
                    slug: pageSlug,
                    sections: generatedSections
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
                this.logger.log(`[${pageSlug}] Successfully generated ${generatedSections.length} sections and saved to DB.`);
            }
            catch (error) {
                this.logger.error(`Failed to generate page ${pageSlug}: ${error.message}`);
            }
        }
        const seoMetadataResult = await seoPromise;
        return {
            designTokens: designSystemResult,
            brandVoice: brandVoiceResult,
            pages: successfulPages,
            seoMetadata: seoMetadataResult,
        };
    }
    getFallbackSection(sectionType) {
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
                return { ...base, content: { items: undefined } };
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
                return { ...base, content: { items: undefined } };
            case 'ServiceDetailsSection':
                return { ...base, content: { overview: "Service overview.", whyChooseUs: ["Quality"], process: ["Step 1"], cta: { heading: "Need help?", subheading: "Contact us.", buttonText: "Get Quote" } } };
            case 'CallToActionSection':
                return { ...base, content: { heading: "Ready to start?", subheading: "Get a free quote today.", buttonText: "Contact Us" } };
            default:
                return { ...base, content: {} };
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
        section_content_skill_1.SectionContentSkill,
        seo_metadata_skill_1.SeoMetadataSkill])
], OrchestratorService);
//# sourceMappingURL=orchestrator.service.js.map