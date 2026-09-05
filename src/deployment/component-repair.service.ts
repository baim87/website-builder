import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubService } from './github.service';
import { DeploymentService } from './deployment.service';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { ComponentValidationSkill, ValidationCritique } from '../skills/impl/component-validation.skill';
import { QCReport } from '../quality-control/quality-control.service';
import { CodeRepairSkill } from '../skills/impl/code-repair.skill';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ComponentRepairService {
  private readonly logger = new Logger(ComponentRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
    private readonly deploymentService: DeploymentService,
    private readonly skillExecutor: SkillExecutorService,
    private readonly validationSkill: ComponentValidationSkill,
    private readonly repairSkill: CodeRepairSkill,
  ) {}

  async runRepairLoop(projectId: string, qcReport?: QCReport): Promise<boolean> {
    this.logger.log(`Starting Git-Centric Component Repair Loop for project ${projectId}`);



    // 1. Get Project & Repo details
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const repoName = `contractor-site-${projectId.toLowerCase().replace(/[^a-z0-9]/g, '')}`; // Assuming naming convention

    // 2. Clone Repo to Temp Directory
    const tmpDir = path.join('/tmp', `repair-${projectId}-${Date.now()}`);
    
    try {
      this.logger.log(`Cloning ${repoName} to ${tmpDir}...`);
      const { clone_url } = await this.githubService.ensureRepository(repoName);
      
      // Inject token for auth clone
      const token = process.env.GITHUB_API_TOKEN;
      const authUrl = clone_url.replace('https://', `https://${token}@`);
      
      await execAsync(`git clone ${authUrl} ${tmpDir}`);

      // 3. Analyze all generated components
      const componentsDir = path.join(tmpDir, 'src/components/generated');
      let files: string[] = [];
      try {
        files = await fs.readdir(componentsDir);
      } catch (e) {
        this.logger.warn(`Could not read components directory at ${componentsDir}`);
        return false;
      }

      // Phase 1: Build the Repair Checklist from the QC Report
      const checklist = new Map<string, { pages: string[], issues: string[] }>();
      
      if (qcReport && qcReport.visualCritiques) {
        for (const vCritique of qcReport.visualCritiques) {
          for (const compIssues of vCritique.issues) {
            if (compIssues.issues.length > 0) {
              const existing = checklist.get(compIssues.componentName) || { pages: [], issues: [] };
              if (!existing.pages.includes(vCritique.pageUrl)) {
                existing.pages.push(vCritique.pageUrl);
              }
              for (const issue of compIssues.issues) {
                if (!existing.issues.includes(issue)) {
                  existing.issues.push(issue);
                }
              }
              checklist.set(compIssues.componentName, existing);
            }
          }
        }
      }

      if (checklist.size > 0) {
        this.logger.log(`Repair Checklist built: ${JSON.stringify(Object.fromEntries(checklist), null, 2)}`);
      }

      let hasFixes = false;

      for (const file of files) {
        if (!file.endsWith('.tsx') || file === 'index.ts') continue;
        
        const componentName = file.replace('.tsx', '');
        const filePath = path.join(componentsDir, file);
        const componentCode = await fs.readFile(filePath, 'utf-8');

        // 4. Validate Component against Zod Schema
        this.logger.log(`Validating ${componentName}...`);
        const validationResult = await this.skillExecutor.executeSkill(this.validationSkill, {
          projectId,
          context: { sectionType: componentName, componentCode }
        });
        
        const critique = validationResult.data as ValidationCritique;

        // Phase 2: Execute Repairs
        let combinedIssues: string[] = [];
        if (!critique.isValid && critique.missingElements.length > 0) {
          this.logger.warn(`Component ${componentName} failed Zod validation! Missing: ${critique.missingElements.join(', ')}`);
          combinedIssues = combinedIssues.concat(critique.missingElements.map(e => `Missing required zod field: ${e}`));
        }

        if (checklist.has(componentName)) {
          const visualIssues = checklist.get(componentName)!.issues;
          this.logger.warn(`Component ${componentName} has Visual QA issues! ${visualIssues.join(', ')}`);
          combinedIssues = combinedIssues.concat(visualIssues);
        }

        if (combinedIssues.length > 0) {
          this.logger.log(`Repairing ${componentName} (Total Issues: ${combinedIssues.length})...`);
          
          const repairResult = await this.skillExecutor.executeSkill(this.repairSkill, {
            projectId,
            context: { 
              sectionType: componentName, 
              brokenCode: componentCode, 
              critique: combinedIssues 
            }
          });

          const fixedCode = repairResult.code || (repairResult.data as any).code || repairResult.data;
          await fs.writeFile(filePath, fixedCode);
          hasFixes = true;
          this.logger.log(`Successfully patched ${componentName} locally.`);
        } else {
          this.logger.log(`Component ${componentName} is valid and has no visual issues.`);
        }
      }

      // 7. Push Fixes to GitHub
      if (hasFixes) {
        this.logger.log(`Pushing repaired components to GitHub...`);
        const user = await this.githubService.getAuthenticatedUser();
        const commitEmail = user.email || process.env.GITHUB_AUTHOR_EMAIL || 'ads@contractingempire.com';
        await execAsync(`git add .`, { cwd: tmpDir });
        await execAsync(`git config user.name "${user.login}"`, { cwd: tmpDir });
        await execAsync(`git config user.email "${commitEmail}"`, { cwd: tmpDir });
        await execAsync(`git commit -m "fix: AI auto-repair for Zod and Visual QA issues"`, { cwd: tmpDir });
        await execAsync(`git push origin main`, { cwd: tmpDir });
        
        this.logger.log(`Waiting for Vercel deployment of repaired site...`);
        await this.deploymentService.waitForDeployment(projectId, project.userId, repoName);
        
        this.logger.log(`Repair Loop Completed successfully.`);
        return true;
      } else {
        this.logger.log(`No components needed repair. Site is perfect.`);
        return false;
      }

    } finally {
      // Cleanup temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
