import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as crypto from 'crypto';
import { GenerationOrchestratorService } from './generation-orchestrator.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { PageService } from '../projects/page.service';
import { SeoArtifactsService } from '../seo/seo-artifacts.service';
import { NextjsBuilderService } from './nextjs-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentService } from '../deployment/deployment.service';
import { CostAggregatorService } from '../skills/cost-aggregator.service';
import { ASSET_PURPOSE } from '../assets/constants/asset-purpose.constant';
import { BrandExtractionService } from '../assets/brand-extraction.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { GENERATION_STATUS } from './constants/generation-status.constant';
import { PROJECT_STATUS } from '../projects/constants/project-status.constant';
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly orchestrator: GenerationOrchestratorService,
    private readonly websiteDataService: WebsiteDataService,
    private readonly businessContextService: BusinessContextService,
    private readonly pageService: PageService,
    private readonly seoArtifacts: SeoArtifactsService,
    private readonly nextjsBuilder: NextjsBuilderService,
    private readonly prisma: PrismaService,
    private readonly deploymentService: DeploymentService,
    private readonly costAggregator: CostAggregatorService,
    private readonly brandExtractionService: BrandExtractionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cls: ClsService,
  ) {}

  async generateProject(projectId: string, userId: string, jobId: string, job?: Job) {
    return this.cls.run(async () => {
      this.cls.set('traceId', jobId || crypto.randomUUID());
      this.cls.set('userId', userId);
      this.cls.set('projectId', projectId);

      const generationStartTimeMs = Date.now();
      this.logger.log(`Starting full generation for project ${projectId} (job: ${jobId})`);
      
      // 1. Acquire atomic lock (retry tolerant)
      await this.websiteDataService.acquireGenerationLock(projectId, userId, jobId);

      try {
        // Tenant Isolation Check
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.userId !== userId) {
          const errMsg = `TenantIsolationError: Project ${projectId} does not belong to user ${userId}`;
          this.logger.fatal ? this.logger.fatal(errMsg) : this.logger.error(errMsg);
          throw new Error(errMsg);
        }

        // 2. Fetch context
        const businessContext = await this.businessContextService.findByProjectId(projectId) as any;
      
      const metaData = businessContext.interviewMetadata || {};

      let finalLogoUrl = metaData.finalLogoUrl;
      if (!finalLogoUrl) {
        const logoAsset = await this.prisma.asset.findFirst({
          where: { projectId, purpose: ASSET_PURPOSE.LOGO },
          orderBy: { createdAt: 'desc' }
        });
        finalLogoUrl = logoAsset?.url || '';
      }
      businessContext.logoUrl = finalLogoUrl;

      if (finalLogoUrl) {
        try {
          const extractedBrand = await this.brandExtractionService.extractBrandFromLogo(finalLogoUrl);
          businessContext.extractedBrand = extractedBrand;
          this.logger.log(`Successfully extracted brand colors from logo: ${JSON.stringify(extractedBrand.colors)}`);
        } catch (error) {
          this.logger.warn(`Failed to extract brand from logo: ${error.message}`);
        }
      }

      let finalPortraitUrl = metaData.finalPortraitUrl;
      if (!finalPortraitUrl) {
        const portraitAsset = await this.prisma.asset.findFirst({
          where: { projectId, purpose: ASSET_PURPOSE.PORTRAIT },
          orderBy: { createdAt: 'desc' }
        });
        finalPortraitUrl = portraitAsset?.url || '';
      }
      businessContext.ownerPortraitUrl = finalPortraitUrl;

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
            }, userId);
          }
        },
        job
      );

      const pagesArray = results.pages;

      // 5. Generate SEO artifacts
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
        generationStatus: GENERATION_STATUS.DEPLOYING,
        lastGeneratedAt: new Date(),
      }, userId);

      // 7. Push to GitHub and Trigger Vercel
      this.logger.log(`Initiating GitHub push & Vercel deployment for project ${projectId}`);
      const deployStartTimeMs = Date.now();
      
      const pushResult = await this.nextjsBuilder.buildAndDeploy(
        projectId, 
        userId,
        async (repoOwner: string, repoName: string, envVars?: any[]) => {
          this.logger.log(`Connecting GitHub to Vercel before push...`);
          await this.deploymentService.linkProjectToGithub(projectId, userId, repoOwner, repoName);
          if (envVars && envVars.length > 0) {
            this.logger.log(`Setting environment variables in Vercel project...`);
            await this.deploymentService.setEnvironmentVariables(repoName, envVars);
          }
        }
      );
      
      // 8. Call DeploymentService to poll for the live URL
      this.logger.log(`Waiting for Vercel deployment to finish...`);
      const deployResult = await this.deploymentService.waitForDeployment(projectId, userId, pushResult.repoName);
      
      const liveUrl = deployResult.url;
      const deployLatencySeconds = ((Date.now() - deployStartTimeMs) / 1000).toFixed(1);
      this.logger.log(`========================================================================`);
      this.logger.log(`✅ Project ${projectId} is LIVE at ${liveUrl}`);
      this.logger.log(`🚀 Deployment Time: ${deployLatencySeconds}s`);
      this.logger.log(`========================================================================`);

      // 8. Mark project as published
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: PROJECT_STATUS.PUBLISHED },
      });

      // 9. Update generation status and clear lock
      await this.websiteDataService.releaseGenerationLock(projectId, userId, 'completed');

      // 10. Trigger Quality Control via event emission
      this.logger.log(`Dispatching Quality Control event for project ${projectId}...`);
      this.eventEmitter.emit('project.generated', {
        projectId, 
        userId, 
        liveUrl, 
        businessName: businessContext.businessName || 'service business'
      });

      this.logger.log(`Completed generation for project ${projectId}. Live at: ${liveUrl}`);
      return liveUrl;
    } catch (error: any) {
      this.logger.error(`Generation failed for project ${projectId}`, error.stack);
      await this.websiteDataService.releaseGenerationLock(projectId, userId, 'failed');
      throw error;
    } finally {
      // Print Cost Report
      const totalWallClockTimeMs = Date.now() - generationStartTimeMs;
      await this.costAggregator.printCostReport(projectId, 'generation', totalWallClockTimeMs);
    }
    });
  }
}
