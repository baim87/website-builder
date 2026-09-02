import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorService } from '../skills/orchestrator.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { PageService } from '../projects/page.service';
import { SeoArtifactsService } from '../seo/seo-artifacts.service';
import { NextjsBuilderService } from './nextjs-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentService } from '../deployment/deployment.service';

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
    private readonly prisma: PrismaService,
    private readonly deploymentService: DeploymentService,
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
            await this.pageService.upsertPage(projectId, pageContent.slug, {
              content: pageContent.sections,
              componentCode: pageContent.componentCode,
              seoMeta: pageContent.seoMeta,
              keywordTarget: pageContent.keywordTarget,
              status: pageContent.status
            });
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
        sitemapXml,
        robotsTxt,
        jsonLdSchemas,
        internalLinkMap,
        generationStatus: 'deploying',
        lastGeneratedAt: new Date(),
      });

      // 7. Push to GitHub and Trigger Vercel
      this.logger.log(`Initiating GitHub push & Vercel deployment for project ${projectId}`);
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error(`Project ${projectId} not found`);
      
      const pushResult = await this.nextjsBuilder.buildAndDeploy(projectId, project.userId);
      
      // 8. Call DeploymentService to connect Vercel and poll for the live URL
      this.logger.log(`Connecting GitHub to Vercel and waiting for build...`);
      const deployResult = await this.deploymentService.deployProjectFromGithub(projectId, project.userId, pushResult.repoOwner, pushResult.repoName);
      
      const liveUrl = deployResult.url;

      // 8. Mark project as published
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PUBLISHED' },
      });

      // 9. Update generation status
      await this.websiteDataService.upsert(projectId, {
        generationStatus: 'completed',
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
