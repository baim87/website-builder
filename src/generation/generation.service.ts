import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorService } from '../skills/orchestrator.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { PageService } from '../projects/page.service';
import { SeoArtifactsService } from '../seo/seo-artifacts.service';
import { NextjsBuilderService } from './nextjs-builder.service';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly websiteDataService: WebsiteDataService,
    private readonly businessContextService: BusinessContextService,
    private readonly pageService: PageService,
    private readonly seoArtifacts: SeoArtifactsService,
    private readonly nextjsBuilder: NextjsBuilderService,
  ) {}

  async generateProject(projectId: string) {
    this.logger.log(`Starting full generation for project ${projectId}`);
    
    // 1. Mark as generating
    await this.websiteDataService.updateGenerationStatus(projectId, 'generating');

    try {
      // 2. Fetch context
      const businessContext = await this.businessContextService.findByProjectId(projectId);

      // 3. Orchestrate skills & save pages incrementally
      const results = await this.orchestrator.generateWebsite(
        projectId, 
        businessContext,
        async (pageContent) => {
          if (pageContent && pageContent.slug) {
            await this.pageService.upsertPage(projectId, pageContent.slug, pageContent.sections);
          }
        }
      );

      const pagesArray = results.pages;

      // 5. Generate SEO artifacts
      // For MVP, we'll use a placeholder domain if none exists.
      const domain = `${projectId}.builder.local`; 
      const sitemapXml = this.seoArtifacts.generateSitemap(domain, pagesArray);
      const robotsTxt = this.seoArtifacts.generateRobotsTxt(domain);
      const jsonLdSchemas = this.seoArtifacts.generateJsonLd(businessContext, domain);
      const internalLinkMap = this.seoArtifacts.generateInternalLinks(pagesArray);

      // 6. Assemble and save to WebsiteData
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

      // 7. Build and Deploy Next.js Project via Vercel
      this.logger.log(`Initiating Next.js build and deploy for project ${projectId}`);
      const liveUrl = await this.nextjsBuilder.buildAndDeploy(projectId);

      // 8. Update generation status with live URL
      await this.websiteDataService.upsert(projectId, {
        generationStatus: 'completed',
        // In a real app we might store the liveUrl in the WebsiteData or Project model
      });

      this.logger.log(`Completed generation for project ${projectId}. Live at: ${liveUrl}`);
      return liveUrl;
    } catch (error: any) {
      this.logger.error(`Generation failed for project ${projectId}`, error.stack);
      await this.websiteDataService.updateGenerationStatus(projectId, 'failed');
      throw error;
    }
  }
}
