import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bullmq';

import { LinkIntegrityService, LinkIntegrityReport } from './link-integrity.service';
import { PageSpeedService, LighthouseReport } from './pagespeed.service';
import { VisualQAService, VisualCritique } from './visual-qa.service';
import { BrowserlessService } from './browserless.service';

import * as crypto from 'crypto';

export interface QCReport {
  sitemapUrls: string[];
  linkReport: LinkIntegrityReport;
  lighthouseReports: LighthouseReport[];
  visualCritiques: VisualCritique[];
}

@Injectable()
export class QualityControlService {
  private readonly logger = new Logger(QualityControlService.name);

  constructor(
    private readonly linkIntegrity: LinkIntegrityService,
    private readonly pageSpeed: PageSpeedService,
    private readonly visualQA: VisualQAService,
    private readonly browserless: BrowserlessService,
    private readonly prisma: PrismaService,
  ) {}

  async runQualityControl(projectId: string, vercelUrl: string, businessType: string, job?: Job): Promise<QCReport> {
    const startTime = Date.now();
    this.logger.log(`Starting QC run for project ${projectId} at ${vercelUrl}`);

    // 1. Get sitemap from DB
    const websiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
    
    // Calculate Project State Hash for Caching
    const pages = await this.prisma.page.findMany({ where: { projectId }, select: { updatedAt: true } });
    const maxPageUpdate = pages.length > 0 ? Math.max(...pages.map(p => p.updatedAt.getTime())) : 0;
    const maxWebsiteUpdate = websiteData?.updatedAt?.getTime() || 0;
    const projectStateTimestamp = Math.max(maxPageUpdate, maxWebsiteUpdate).toString();
    const inputHash = crypto.createHash('sha256').update(`${projectId}-${projectStateTimestamp}`).digest('hex');

    // Check Cache
    const cachedAudit = await this.prisma.skillInvocation.findFirst({
      where: { projectId, skillType: 'QA_AUDIT', inputHash, status: 'success' },
      orderBy: { createdAt: 'desc' }
    });

    if (cachedAudit && cachedAudit.outputData) {
      this.logger.log(`[CACHE HIT] Found exact match for QA Audit (Hash: ${inputHash}). Skipping expensive QA phase...`);
      return cachedAudit.outputData as unknown as QCReport;
    }

    let sitemapUrls: string[] = [];
    
    if (websiteData && websiteData.sitemapXml) {
      const urls = websiteData.sitemapXml.match(/<loc>(.*?)<\/loc>/g)
        ?.map(m => m.replace(/<\/?loc>/g, '')) || [];
      // Replace placeholder domain with actual vercelUrl
      const vercelOrigin = new URL(vercelUrl).origin;
      sitemapUrls = urls.map(u => {
        try {
          const path = new URL(u).pathname;
          return `${vercelOrigin}${path}`;
        } catch {
          return u;
        }
      });
    }

    if (sitemapUrls.length === 0) {
      this.logger.warn(`No sitemap found for ${projectId}, falling back to root`);
      sitemapUrls = [vercelUrl];
    }
    this.logger.log(`Found ${sitemapUrls.length} pages in sitemap`);

    // 2. Check link integrity
    if (job) await job.updateProgress({ step: 'LINK_INTEGRITY' });
    const linkReport = await this.linkIntegrity.checkLinks(sitemapUrls);


    // 3. Visual QA (Sequential safe processing with Garbage Collection)
    const visualCritiques: VisualCritique[] = [];
    let progressCount = 0;
    const totalCritiqueJobs = sitemapUrls.length * 2; // Mobile + Desktop

    for (const pageUrl of sitemapUrls) {
      const urlObj = new URL(pageUrl);
      const slug = urlObj.pathname === '/' ? 'home' : urlObj.pathname.slice(1).replace(/\/$/, '');
      
      const page = await this.prisma.page.findFirst({
        where: { projectId, slug },
      });
      
      let componentsOnPage: string[] = [];
      if (page && page.content) {
         try {
           const ast = typeof page.content === 'string' ? JSON.parse(page.content) : page.content;
           if (Array.isArray(ast)) {
             componentsOnPage = ast.map((node: any) => `${node.type}: ${JSON.stringify(node)}`);
           }
         } catch(e) {
           this.logger.error(`Failed to parse page content for ${pageUrl}: ${e.message}`);
         }
      }
      
      if (componentsOnPage.length === 0) {
        componentsOnPage = ['HeaderSection', 'HeroSection', 'FooterSection'];
      }

      // Mobile Pass
      let mobileRetries = 3;
      const mobileHash = crypto.createHash('sha256').update(`${projectId}-mobile-${pageUrl}-${projectStateTimestamp}`).digest('hex');
      const cachedMobile = await this.prisma.skillInvocation.findFirst({ where: { skillType: 'QA_PAGE_AUDIT', inputHash: mobileHash, status: 'success' }, orderBy: { createdAt: 'desc' } });
      
      if (cachedMobile && cachedMobile.outputData) {
        this.logger.log(`[CHECKPOINT HIT] Mobile QA for ${pageUrl} loaded from cache.`);
        visualCritiques.push(cachedMobile.outputData as unknown as VisualCritique);
      } else {
        while (mobileRetries > 0) {
          try {
            if (job) await job.updateProgress({ step: 'VISUAL_QA_MOBILE', url: pageUrl, progress: Math.round((progressCount / totalCritiqueJobs) * 100) });
            const mobileScreenshot = await this.browserless.captureFullPage(pageUrl, true);
            const mobileCritique = await this.visualQA.critiqueScreenshot(
              mobileScreenshot,
              pageUrl,
              businessType,
              componentsOnPage,
              'mobile'
            );
            visualCritiques.push(mobileCritique);
            await this.prisma.skillInvocation.create({
              data: { projectId, skillType: 'QA_PAGE_AUDIT', model: 'system', inputHash: mobileHash, outputData: mobileCritique as any, status: 'success' }
            });
            break;
          } catch (err: any) {
            mobileRetries--;
            this.logger.error(`Mobile QA failed for ${pageUrl}: ${err.message}. Retries left: ${mobileRetries}`);
            if (mobileRetries === 0) break;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      progressCount++;

      // Desktop Pass
      let desktopRetries = 3;
      const desktopHash = crypto.createHash('sha256').update(`${projectId}-desktop-${pageUrl}-${projectStateTimestamp}`).digest('hex');
      const cachedDesktop = await this.prisma.skillInvocation.findFirst({ where: { skillType: 'QA_PAGE_AUDIT', inputHash: desktopHash, status: 'success' }, orderBy: { createdAt: 'desc' } });

      if (cachedDesktop && cachedDesktop.outputData) {
        this.logger.log(`[CHECKPOINT HIT] Desktop QA for ${pageUrl} loaded from cache.`);
        visualCritiques.push(cachedDesktop.outputData as unknown as VisualCritique);
      } else {
        while (desktopRetries > 0) {
          try {
            if (job) await job.updateProgress({ step: 'VISUAL_QA_DESKTOP', url: pageUrl, progress: Math.round((progressCount / totalCritiqueJobs) * 100) });
            const desktopScreenshot = await this.browserless.captureFullPage(pageUrl, false);
            const desktopCritique = await this.visualQA.critiqueScreenshot(
              desktopScreenshot,
              pageUrl,
              businessType,
              componentsOnPage,
              'desktop'
            );
            visualCritiques.push(desktopCritique);
            await this.prisma.skillInvocation.create({
              data: { projectId, skillType: 'QA_PAGE_AUDIT', model: 'system', inputHash: desktopHash, outputData: desktopCritique as any, status: 'success' }
            });
            break;
          } catch (err: any) {
            desktopRetries--;
            this.logger.error(`Desktop QA failed for ${pageUrl}: ${err.message}. Retries left: ${desktopRetries}`);
            if (desktopRetries === 0) break;
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      progressCount++;
    }

    // 4. Run PageSpeed for Performance metrics
    if (job) await job.updateProgress({ step: 'PAGESPEED' });
    const lighthouseReports = await this.pageSpeed.auditAllPages(sitemapUrls);

    // Determine Status
    const hasBrokenLinks = linkReport.brokenLinks.length > 0;
    const hasPoorPerformance = lighthouseReports.some(r => r.performance < 90);
    const hasVisualIssues = visualCritiques.some(c => c.overallScore < 9);
    const status = (hasBrokenLinks || hasPoorPerformance || hasVisualIssues) ? 'failed' : 'passed';
    
    this.logger.log(`QC completed for project ${projectId}. Status: ${status}`);

    if (job) await job.updateProgress({ step: 'COMPLETED', status });

    const finalReport = { sitemapUrls, linkReport, lighthouseReports, visualCritiques };

    // Save to Cache
    await this.prisma.skillInvocation.create({
      data: {
        projectId,
        skillType: 'QA_AUDIT',
        model: 'system',
        inputHash,
        outputData: finalReport as any,
        status: 'success',
        latencyMs: Date.now() - startTime
      }
    });

    return finalReport;
  }
}
