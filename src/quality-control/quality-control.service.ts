import { Injectable, Logger } from '@nestjs/common';
import { SitemapCrawlerService } from './sitemap-crawler.service';
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
    private readonly sitemapCrawler: SitemapCrawlerService,
    private readonly linkIntegrity: LinkIntegrityService,
    private readonly pageSpeed: PageSpeedService,
    private readonly visualQA: VisualQAService,
  ) {}

  async runQualityControl(projectId: string, vercelUrl: string, businessType: string): Promise<QCReport> {
    this.logger.log(`Starting QC run for project ${projectId} at ${vercelUrl}`);

    // 1. Crawl sitemap
    const sitemapUrls = await this.sitemapCrawler.crawlSitemap(vercelUrl);
    this.logger.log(`Found ${sitemapUrls.length} pages in sitemap`);

    // 2. Check link integrity
    const linkReport = await this.linkIntegrity.checkLinks(sitemapUrls);

    // 3. Run PageSpeed on key pages
    const keyPages = sitemapUrls.filter(u =>
      ['/', '/services', '/contact', '/about-us', '/service-areas'].some(p => u.endsWith(p))
    );
    const lighthouseReports = await this.pageSpeed.auditAllPages(keyPages);

    // 4. Send screenshots to AI vision model for critique
    const visualCritiques: VisualCritique[] = [];
    for (const report of lighthouseReports.filter(r => r.strategy === 'mobile')) {
      if (report.screenshotBase64) {
        try {
          const critique = await this.visualQA.critiqueScreenshot(
            report.screenshotBase64,
            report.url,
            businessType,
          );
          visualCritiques.push(critique);
        } catch (err: any) {
           this.logger.error(`Failed to generate visual critique for ${report.url}: ${err.message}`);
        }
      }
    }

    // Determine Status
    const hasBrokenLinks = linkReport.brokenLinks.length > 0;
    const hasPoorPerformance = lighthouseReports.some(r => r.performance < 70);
    const hasVisualIssues = visualCritiques.some(c => c.overallScore < 7);
    const status = (hasBrokenLinks || hasPoorPerformance || hasVisualIssues) ? 'failed' : 'passed';

    // 5. Store QC report in database
    // For now we will mock this because Prisma Schema needs to be updated for QualityReport
    /*
    await this.prisma.qualityReport.create({
      data: {
        projectId,
        sitemapUrls,
        brokenLinks: linkReport.brokenLinks,
        orphanPages: linkReport.orphanPages,
        lighthouseScores: lighthouseReports,
        visualCritiques,
        status,
      }
    });
    */
    
    this.logger.log(`QC completed for project ${projectId}. Status: ${status}`);

    return { sitemapUrls, linkReport, lighthouseReports, visualCritiques };
  }
}
