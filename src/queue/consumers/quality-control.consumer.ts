import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, DelayedError } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { QualityControlService, QCReport } from '../../quality-control/quality-control.service';
import { QualityControlJobData } from '../interfaces/job-data.interface';
import { ComponentRepairService } from '../../deployment/component-repair.service';
import { CopywritingRepairService } from '../../deployment/copywriting-repair.service';
import { BrandRepairService } from '../../deployment/brand-repair.service';
import { GithubService } from '../../deployment/github.service';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
// import { AssetRepairService } from '../../deployment/asset-repair.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CostAggregatorService } from '../../skills/cost-aggregator.service';
import { generateRepoName } from '../../common/utils/repo.util';

function formatPageName(url: string): string {
  if (url === '/' || url === '') return 'Home';
  const name = url.split('/').pop() || '';
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

type QCState = 'AUDIT' | 'WAIT_ASSETS' | 'REPAIR_COMPONENTS' | 'WAIT_DEPLOY';

interface StateData {
  qcState?: QCState;
  attempt?: number;
  maxAttempts?: number;
  finalReport?: QCReport | null;
  previousIssuesStr?: string;
  isSuccess?: boolean;
  previousIssues?: Map<string, string[]>;
  didRepairAsset?: boolean;
}

@Processor(QUEUE_NAMES.QUALITY_CONTROL)
export class QualityControlConsumer extends WorkerHost {
  private readonly logger = new Logger(QualityControlConsumer.name);

  constructor(
    private readonly qualityControlService: QualityControlService,
    private readonly componentRepairService: ComponentRepairService,
    private readonly copywritingRepairService: CopywritingRepairService,
    private readonly brandRepairService: BrandRepairService,
    private readonly githubService: GithubService,
    // private readonly assetRepairService: AssetRepairService,
    private readonly prisma: PrismaService,
    private readonly costAggregator: CostAggregatorService,
  ) {
    super();
  }

  async process(job: Job<QualityControlJobData & StateData>) {
    const { projectId, userId, vercelUrl, businessType, maxAttempts = 3 } = job.data;
    let { attempt = 1, qcState = 'AUDIT', finalReport = null, isSuccess = false, didRepairAsset = false } = job.data;
    
    let previousIssues: Map<string, string[]> = job.data.previousIssuesStr 
      ? new Map(JSON.parse(job.data.previousIssuesStr))
      : new Map();
      
    const timestamp = new Date().toISOString();
    this.logger.log(`[${projectId} - ${timestamp}] Processing QC auto-repair job. State: ${qcState}, Attempt: ${attempt}`);
    
    // --- TEMPORARY BYPASS FOR PRICING TIERS ---
    // User requested to disable QC for now, as it will be reserved for the future Platinum King tier.
    // We instantly mark it as passed so the pipeline can continue without deleting the code.
    this.logger.log(`[${projectId}] QC Bypass Active: Skipping QC audit (Reserved for Platinum Tier). Marking as passed.`);
    return this.finalize(projectId, userId, true, null, maxAttempts);
    
    if (attempt === 1 && qcState === 'AUDIT') {
      await this.prisma.websiteData.updateMany({
        where: { projectId, project: { userId } },
        data: { qcStatus: 'running' }
      });
    }

    try {
      if (qcState === 'AUDIT') {
        if (attempt > 1) {
          this.logger.log(`Revalidate fix attempt : ${attempt - 1}`);
        }
        
        const report = await this.qualityControlService.runQualityControl(projectId, vercelUrl, businessType, job);
        finalReport = report;
        
        const currentIssues = new Map<string, string[]>();
        for (const vCritique of report.visualCritiques) {
          for (const comp of vCritique.issues) {
            if (comp.issues.length > 0) {
              const pages = currentIssues.get(comp.componentName) || [];
              if (!pages.includes(vCritique.pageUrl)) pages.push(vCritique.pageUrl);
              currentIssues.set(comp.componentName, pages);
            }
          }
        }

        if (attempt > 1) {
          for (const [compName, prevPages] of previousIssues.entries()) {
            const currentPages = currentIssues.get(compName) || [];
            for (const prevPage of prevPages) {
              if (!currentPages.includes(prevPage)) {
                this.logger.log(`Section : ${compName}, Page : ${formatPageName(prevPage)} QC Passed`);
              }
            }
          }
        }
        
        previousIssues = currentIssues;

        const hasBrokenLinks = report.linkReport.brokenLinks.length > 0;
        const hasPoorPerformance = report.lighthouseReports.some(r => r.performance < 90);
        const hasVisualIssues = currentIssues.size > 0;
        const isFailed = hasBrokenLinks || hasPoorPerformance || hasVisualIssues;

        if (!isFailed) {
          this.logger.log(`loop until all been pass the audit!`);
          isSuccess = true;
          return this.finalize(projectId, userId, isSuccess, finalReport, maxAttempts);
        }

        if (attempt < maxAttempts) {
          this.logger.log(`Needed components to be repair!`);
          for (const [compName, pages] of currentIssues.entries()) {
            for (const page of pages) {
               this.logger.log(`Section : ${compName}, Page : ${formatPageName(page)}, Attempt : ${attempt}`);
            }
          }

          let currentDidRepairAsset = false;
          for (const vCritique of report.visualCritiques) {
            for (const comp of vCritique.issues) {
              for (const issue of comp.issues as any[]) {
                 if (issue.issueType === 'ASSET' && issue.imageUrl) {
                   // await this.assetRepairService.repairAsset(projectId, issue.imageUrl, issue.description);
                   // currentDidRepairAsset = true;
                   this.logger.log(`Skipping Asset Repair for ${issue.imageUrl} (Feature Disabled by User)`);
                 }
              }
            }
          }

          if (currentDidRepairAsset) {
            this.logger.log('Waiting for Asset Repairs to finish generating...');
            qcState = 'WAIT_ASSETS';
            await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues, didRepairAsset: true });
          } else {
            qcState = 'REPAIR_COMPONENTS';
            // Continue immediately
          }
        } else {
          this.logger.error(`Project ${projectId} failed QC 3 times. Giving up on auto-repair.`);
          return this.finalize(projectId, userId, false, finalReport, maxAttempts);
        }
      }

      if (qcState === 'WAIT_ASSETS') {
        const pendingAssets = await this.prisma.projectAsset.count({
          where: { projectId, status: 'pending' }
        });
        
        if (pendingAssets > 0) {
          // Still waiting, requeue
          await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues, didRepairAsset: true });
        }
        
        this.logger.log('Asset repairs complete. (TODO: Trigger Vercel rebuild...)');
        // If we strictly need an empty commit, we could do it here, but actually the asset repairs 
        // changed the DB. Wait, if assets changed in the DB, we MUST rebuild content.json!
        // We can just proceed to REPAIR_COMPONENTS which will clone and push!
        qcState = 'REPAIR_COMPONENTS';
        await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues, didRepairAsset: true });
      }

      if (qcState === 'REPAIR_COMPONENTS') {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error(`Project ${projectId} not found`);
        
        const businessContext = await this.prisma.businessContext.findUnique({ where: { projectId } });
        const repoName = generateRepoName(businessContext?.businessName, projectId);
        const tmpDir = path.join('/tmp', `repair-${projectId}-${Date.now()}`);
        let hasAnyFixes = false;

        try {
          this.logger.log(`Cloning ${repoName} to ${tmpDir}...`);
          const { clone_url } = await this.githubService.ensureRepository(repoName);
          const token = process.env.GITHUB_API_TOKEN;
          const authUrl = clone_url.replace('https://', `https://${token}@`);
          await execAsync(`git clone ${authUrl} ${tmpDir}`);

          const codeFixed = await this.componentRepairService.repair(projectId, tmpDir, finalReport!, attempt);
          const copyFixed = await this.copywritingRepairService.repair(projectId, tmpDir, finalReport!, attempt);
          const brandFixed = await this.brandRepairService.repair(projectId, tmpDir, finalReport!, attempt);

          hasAnyFixes = codeFixed || copyFixed || brandFixed || didRepairAsset;

          if (hasAnyFixes) {
            this.logger.log(`Queueing GitHub sync and Vercel deployment for repaired site...`);
            await this.githubService.commitAndPush(repoName, tmpDir, projectId, userId, true);
          } else {
             this.logger.warn(`Repair loop reported no fixes could be made. Stopping early.`);
             const fs = require('fs').promises;
             await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
             return this.finalize(projectId, userId, false, finalReport, maxAttempts);
          }
        } catch (error) {
          const fs = require('fs').promises;
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
          throw error;
        }
        
        this.logger.log(`Repair loop pushed fixes to GitHub queue. Waiting for deploy...`);
        qcState = 'WAIT_DEPLOY';
        await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues });
      }

      if (qcState === 'WAIT_DEPLOY') {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        
        // If it's still deploying, wait. 
        if (project?.status === 'DEPLOYING') {
          await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues });
        }
        
        this.logger.log(`Vercel deployment is ready. Running next QC attempt...`);
        qcState = 'AUDIT';
        attempt++;
        await this.saveStateAndDelay(job, { qcState, attempt, finalReport, previousIssues }, 1000);
      }

    } catch (error: any) {
      if (error instanceof DelayedError) {
        throw error; // Let BullMQ handle the delay
      }
      this.logger.error(`Error during QC attempt ${attempt}: ${error.stack || error.message}`);
      if (attempt === maxAttempts) {
         return this.finalize(projectId, userId, false, finalReport, maxAttempts);
      }
      throw error; // Fail the job so BullMQ retries
    }
  }

  private async saveStateAndDelay(job: Job, state: Partial<StateData>, delayMs = 5000) {
    const serializedState = {
      ...state,
      previousIssuesStr: state.previousIssues ? JSON.stringify(Array.from(state.previousIssues.entries())) : undefined,
    };
    delete serializedState.previousIssues; // don't store Map directly in job JSON
    
    await job.updateData({ ...job.data, ...serializedState });
    await job.moveToDelayed(Date.now() + delayMs, job.token!);
    throw new DelayedError();
  }

  private async finalize(projectId: string, userId: string, isSuccess: boolean, finalReport: QCReport | null, maxAttempts: number) {
    await this.prisma.websiteData.updateMany({
      where: { projectId, project: { userId } },
      data: { 
        qcStatus: isSuccess ? 'passed' : 'failed',
        qcReport: finalReport as any 
      }
    });

    if (!isSuccess && finalReport) {
      this.printFailureReport(projectId, finalReport, maxAttempts);
    }

    await this.costAggregator.printCostReport(projectId, 'repair');
  }

  private printFailureReport(projectId: string, report: QCReport, maxAttempts: number) {
    const hr = '══════════════════════════════════════════════════';
    this.logger.error(`\n╔${hr}╗`);
    this.logger.error(`║     QC AUTO-REPAIR FAILED — MANUAL FIX NEEDED   ║`);
    this.logger.error(`╠${hr}╣`);
    this.logger.error(`║ Project: ${projectId.padEnd(39)}║`);
    this.logger.error(`║ Attempts: ${maxAttempts}/${maxAttempts}`.padEnd(51) + `║`);
    this.logger.error(`╠${hr}╣`);
    this.logger.error(`║                                                  ║`);
    this.logger.error(`║ UNRESOLVED ISSUES:                               ║`);
    this.logger.error(`║                                                  ║`);
    
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
