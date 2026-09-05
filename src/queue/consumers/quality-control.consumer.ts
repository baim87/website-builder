import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { QualityControlService, QCReport } from '../../quality-control/quality-control.service';
import { ComponentRepairService } from '../../deployment/component-repair.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor(QUEUE_NAMES.QUALITY_CONTROL)
export class QualityControlConsumer extends WorkerHost {
  private readonly logger = new Logger(QualityControlConsumer.name);

  constructor(
    private readonly qualityControlService: QualityControlService,
    private readonly componentRepairService: ComponentRepairService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ projectId: string; vercelUrl: string; businessType: string }>) {
    const { projectId, vercelUrl, businessType } = job.data;
    
    this.logger.log(`Processing QC auto-repair job for project ${projectId}`);
    
    // Mark QC as running
    await this.prisma.websiteData.updateMany({
      where: { projectId },
      data: { qcStatus: 'running' }
    });

    const maxAttempts = 3;
    let finalReport: QCReport | null = null;
    let isSuccess = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.log(`QC Attempt ${attempt}/${maxAttempts} for ${projectId}...`);
      
      try {
        const report = await this.qualityControlService.runQualityControl(projectId, vercelUrl, businessType);
        finalReport = report;
        
        const hasBrokenLinks = report.linkReport.brokenLinks.length > 0;
        const hasPoorPerformance = report.lighthouseReports.some(r => r.performance < 90);
        const hasVisualIssues = report.visualCritiques.some(c => c.overallScore < 9);
        const isFailed = hasBrokenLinks || hasPoorPerformance || hasVisualIssues;

        if (!isFailed) {
          this.logger.log(`QC PASSED ✓ on attempt ${attempt}`);
          isSuccess = true;
          break;
        }

        if (attempt < maxAttempts) {
          this.logger.warn(`QC Failed. Triggering Repair Loop...`);
          const didRepair = await this.componentRepairService.runRepairLoop(projectId, report);
          
          if (!didRepair) {
            this.logger.warn(`Repair loop reported no fixes could be made. Stopping early.`);
            break;
          }
          this.logger.log(`Repair loop pushed fixes to Vercel. Running next QC attempt...`);
        } else {
          this.logger.error(`Project ${projectId} failed QC 3 times. Giving up on auto-repair.`);
        }
      } catch (error: any) {
        this.logger.error(`Error during QC attempt ${attempt}: ${error.message}`);
        if (attempt === maxAttempts) throw error;
      }
    }

    // Update final status
    await this.prisma.websiteData.updateMany({
      where: { projectId },
      data: { 
        qcStatus: isSuccess ? 'passed' : 'failed',
        qcReport: finalReport as any 
      }
    });

    // Print CLI Failure Report if needed
    if (!isSuccess && finalReport) {
      this.printFailureReport(projectId, finalReport);
    }
  }

  private printFailureReport(projectId: string, report: QCReport) {
    const hr = '══════════════════════════════════════════════════';
    this.logger.error(`\n╔${hr}╗`);
    this.logger.error(`║     QC AUTO-REPAIR FAILED — MANUAL FIX NEEDED   ║`);
    this.logger.error(`╠${hr}╣`);
    this.logger.error(`║ Project: ${projectId.padEnd(39)}║`);
    this.logger.error(`║ Attempts: 3/3                                    ║`);
    this.logger.error(`╠${hr}╣`);
    this.logger.error(`║                                                  ║`);
    this.logger.error(`║ UNRESOLVED ISSUES:                               ║`);
    this.logger.error(`║                                                  ║`);
    
    // Group visual issues by page
    const pageMap = new Map<string, any[]>();
    for (const vCritique of report.visualCritiques) {
      if (!pageMap.has(vCritique.pageUrl)) pageMap.set(vCritique.pageUrl, []);
      for (const comp of vCritique.issues) {
        if (comp.issues.length > 0) {
          pageMap.get(vCritique.pageUrl)!.push(comp);
        }
      }
    }

    for (const [pageUrl, components] of pageMap.entries()) {
      if (components.length === 0) continue;
      
      const path = new URL(pageUrl).pathname;
      this.logger.error(`║ Page: ${path.padEnd(43)}║`);
      
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const isLastComp = i === components.length - 1;
        this.logger.error(`║   ${isLastComp ? '└─' : '├─'} ${comp.componentName.padEnd(38)}║`);
        
        for (const issue of comp.issues) {
          const truncated = issue.length > 40 ? issue.substring(0, 37) + '...' : issue;
          this.logger.error(`║       • ${truncated.padEnd(41)}║`);
        }
      }
      this.logger.error(`║                                                  ║`);
    }
    
    // Add performance issues if any
    const perfIssues = report.lighthouseReports.filter(r => r.performance < 90);
    if (perfIssues.length > 0) {
      this.logger.error(`║ PERFORMANCE:                                     ║`);
      for (const r of perfIssues) {
        const path = new URL(r.url).pathname;
        this.logger.error(`║   • ${path}: ${r.performance}/100 (${r.strategy})`.padEnd(49) + `║`);
      }
      this.logger.error(`║                                                  ║`);
    }

    this.logger.error(`╚${hr}╝\n`);
  }
}
