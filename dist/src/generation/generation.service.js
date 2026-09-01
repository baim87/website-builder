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
var GenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationService = void 0;
const common_1 = require("@nestjs/common");
const orchestrator_service_1 = require("../skills/orchestrator.service");
const website_data_service_1 = require("../projects/website-data.service");
const business_context_service_1 = require("../projects/business-context.service");
const page_service_1 = require("../projects/page.service");
const seo_artifacts_service_1 = require("../seo/seo-artifacts.service");
const nextjs_builder_service_1 = require("./nextjs-builder.service");
let GenerationService = GenerationService_1 = class GenerationService {
    orchestrator;
    websiteDataService;
    businessContextService;
    pageService;
    seoArtifacts;
    nextjsBuilder;
    logger = new common_1.Logger(GenerationService_1.name);
    constructor(orchestrator, websiteDataService, businessContextService, pageService, seoArtifacts, nextjsBuilder) {
        this.orchestrator = orchestrator;
        this.websiteDataService = websiteDataService;
        this.businessContextService = businessContextService;
        this.pageService = pageService;
        this.seoArtifacts = seoArtifacts;
        this.nextjsBuilder = nextjsBuilder;
    }
    async generateProject(projectId) {
        this.logger.log(`Starting full generation for project ${projectId}`);
        await this.websiteDataService.updateGenerationStatus(projectId, 'generating');
        try {
            const businessContext = await this.businessContextService.findByProjectId(projectId);
            const results = await this.orchestrator.generateWebsite(projectId, businessContext, async (pageContent) => {
                if (pageContent && pageContent.slug) {
                    await this.pageService.upsertPage(projectId, pageContent.slug, pageContent.sections);
                }
            });
            const pagesArray = results.pages;
            const domain = `${projectId}.builder.local`;
            const sitemapXml = this.seoArtifacts.generateSitemap(domain, pagesArray);
            const robotsTxt = this.seoArtifacts.generateRobotsTxt(domain);
            const jsonLdSchemas = this.seoArtifacts.generateJsonLd(businessContext, domain);
            const internalLinkMap = this.seoArtifacts.generateInternalLinks(pagesArray);
            await this.websiteDataService.upsert(projectId, {
                designTokens: results.designTokens,
                seoMetadata: results.seoMetadata,
                sitemapXml,
                robotsTxt,
                jsonLdSchemas,
                internalLinkMap,
                generationStatus: 'deploying',
                lastGeneratedAt: new Date(),
            });
            this.logger.log(`Initiating Next.js build and deploy for project ${projectId}`);
            const liveUrl = await this.nextjsBuilder.buildAndDeploy(projectId);
            await this.websiteDataService.upsert(projectId, {
                generationStatus: 'completed',
            });
            this.logger.log(`Completed generation for project ${projectId}. Live at: ${liveUrl}`);
            return liveUrl;
        }
        catch (error) {
            this.logger.error(`Generation failed for project ${projectId}`, error.stack);
            await this.websiteDataService.updateGenerationStatus(projectId, 'failed');
            throw error;
        }
    }
};
exports.GenerationService = GenerationService;
exports.GenerationService = GenerationService = GenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [orchestrator_service_1.OrchestratorService,
        website_data_service_1.WebsiteDataService,
        business_context_service_1.BusinessContextService,
        page_service_1.PageService,
        seo_artifacts_service_1.SeoArtifactsService,
        nextjs_builder_service_1.NextjsBuilderService])
], GenerationService);
//# sourceMappingURL=generation.service.js.map