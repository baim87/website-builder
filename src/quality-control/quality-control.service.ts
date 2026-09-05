import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { LinkIntegrityService, LinkIntegrityReport } from './link-integrity.service';
import { PageSpeedService, LighthouseReport } from './pagespeed.service';
import { VisualQAService, VisualCritique } from './visual-qa.service';

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
    private readonly prisma: PrismaService,
  ) {}

  async runQualityControl(projectId: string, vercelUrl: string, businessType: string): Promise<QCReport> {
    this.logger.log(`Starting QC run for project ${projectId} at ${vercelUrl}`);

    // 1. Get sitemap from DB
    const websiteData = await this.prisma.websiteData.findUnique({ where: { projectId } });
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
    const linkReport = await this.linkIntegrity.checkLinks(sitemapUrls);

    // 3. Run PageSpeed on all sitemap pages
    const lighthouseReports = await this.pageSpeed.auditAllPages(sitemapUrls);

    // 4. Send screenshots to AI vision model for critique (both mobile & desktop)
    const visualCritiques: VisualCritique[] = [];
    for (const report of lighthouseReports) {
      if (report.screenshotBase64) {
        try {
          const urlObj = new URL(report.url);
          const slug = urlObj.pathname === '/' ? 'home' : urlObj.pathname.slice(1).replace(/\/$/, '');
          
          const page = await this.prisma.page.findFirst({
            where: { projectId, slug },
          });
          
          let componentsOnPage: string[] = [];
          if (page && page.content) {
             try {
               const ast = JSON.parse(page.content as string);
               componentsOnPage = ast.map((node: any) => node.type);
             } catch(e) {}
          }
          
          if (componentsOnPage.length === 0) {
            componentsOnPage = ['HeaderSection', 'HeroSection', 'FooterSection'];
          }

          const critique = await this.visualQA.critiqueScreenshot(
            report.screenshotBase64,
            report.url,
            businessType,
            componentsOnPage,
            report.strategy
          );
          visualCritiques.push(critique);
        } catch (err: any) {
           this.logger.error(`Failed to generate visual critique for ${report.url}: ${err.message}`);
        }
      }
    }

    // Determine Status (now just used for logging here, actual status logic is in consumer)
    const hasBrokenLinks = linkReport.brokenLinks.length > 0;
    const hasPoorPerformance = lighthouseReports.some(r => r.performance < 90);
    const hasVisualIssues = visualCritiques.some(c => c.overallScore < 9);
    const status = (hasBrokenLinks || hasPoorPerformance || hasVisualIssues) ? 'failed' : 'passed';
    
    this.logger.log(`QC completed for project ${projectId}. Status: ${status}`);

    return { sitemapUrls, linkReport, lighthouseReports, visualCritiques };
  }
}
