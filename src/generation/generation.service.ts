import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorService } from '../skills/orchestrator.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { PageService } from '../projects/page.service';
import { SeoArtifactsService } from '../seo/seo-artifacts.service';
import { NextjsBuilderService } from './nextjs-builder.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentService } from '../deployment/deployment.service';
import { QualityControlProducer } from '../queue/producers/quality-control.producer';
import { CostAggregatorService } from '../skills/cost-aggregator.service';
import { BrandExtractionService } from '../assets/brand-extraction.service';

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
    private readonly qualityControlProducer: QualityControlProducer,
    private readonly costAggregator: CostAggregatorService,
    private readonly brandExtractionService: BrandExtractionService,
  ) {}

  async generateProject(projectId: string, userId: string, jobId: string) {
    const generationStartTimeMs = Date.now();
    this.logger.log(`Starting full generation for project ${projectId} (job: ${jobId})`);
    
    // 1. Acquire atomic lock (retry tolerant)
    await this.websiteDataService.acquireGenerationLock(projectId, userId, jobId);

    try {
      // 2. Fetch context
      const businessContext = await this.businessContextService.findByProjectId(projectId) as any;
      
      const logoAsset = await this.prisma.asset.findFirst({
        where: { projectId, OR: [{ purpose: 'logo' }, { type: 'image' }] },
      });
      businessContext.logoUrl = logoAsset?.url || '';

      if (logoAsset?.url) {
        try {
          const extractedBrand = await this.brandExtractionService.extractBrandFromLogo(logoAsset.url);
          businessContext.extractedBrand = extractedBrand;
          this.logger.log(`Successfully extracted brand colors from logo: ${JSON.stringify(extractedBrand.colors)}`);
        } catch (error) {
          this.logger.warn(`Failed to extract brand from logo: ${error.message}`);
        }
      }

      const portraitAsset = await this.prisma.asset.findFirst({
        where: { projectId, purpose: 'portrait' },
      });
      businessContext.ownerPortraitUrl = portraitAsset?.url || '';

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
        }
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
        generationStatus: 'deploying',
        lastGeneratedAt: new Date(),
      }, userId);

      // Print Cost Report
      const totalWallClockTimeMs = Date.now() - generationStartTimeMs;
      await this.costAggregator.printCostReport(projectId, 'generation', totalWallClockTimeMs);

      // 7. Push to GitHub and Trigger Vercel
      this.logger.log(`Initiating GitHub push & Vercel deployment for project ${projectId}`);
      const deployStartTimeMs = Date.now();
      
      const pushResult = await this.nextjsBuilder.buildAndDeploy(
        projectId, 
        userId,
        async (repoOwner: string, repoName: string) => {
          this.logger.log(`Connecting GitHub to Vercel before push...`);
          await this.deploymentService.linkProjectToGithub(projectId, userId, repoOwner, repoName);
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
        data: { status: 'PUBLISHED' },
      });

      // 9. Update generation status and clear lock
      await this.websiteDataService.releaseGenerationLock(projectId, userId, 'completed');

      // 10. Trigger Quality Control in the background
      this.logger.log(`Dispatching Quality Control job for project ${projectId}...`);
      await this.qualityControlProducer.triggerQualityControl(
        projectId, 
        userId,
        liveUrl, 
        businessContext.businessName || 'service business'
      );

      this.logger.log(`Completed generation for project ${projectId}. Live at: ${liveUrl}`);
      return liveUrl;
    } catch (error: any) {
      this.logger.error(`Generation failed for project ${projectId}`, error.stack);
      await this.websiteDataService.releaseGenerationLock(projectId, userId, 'failed');
      throw error;
    }
  }
}
