import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { SkillExecutorService } from '../skills/skill-executor.service';
import { ComponentValidationSkill, ValidationCritique } from '../skills/impl/component-validation.skill';
import { QCReport } from '../quality-control/quality-control.service';
import { CodeRepairSkill } from '../skills/impl/code-repair.skill';
import { promises as fs } from 'fs';
import * as path from 'path';


function formatPageName(url: string): string {
  if (url === '/' || url === '') return 'Home';
  const name = url.split('/').pop() || '';
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

@Injectable()
export class ComponentRepairService {
  private readonly logger = new Logger(ComponentRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillExecutor: SkillExecutorService,
    private readonly validationSkill: ComponentValidationSkill,
    private readonly repairSkill: CodeRepairSkill,
  ) {}

  async repair(projectId: string, tmpDir: string, qcReport: QCReport, attempt: number = 1): Promise<boolean> {
    const timestamp = new Date().toISOString();
    this.logger.log(`[${projectId} - ${timestamp}] Starting Git-Centric Component Repair Loop`);

    // Fetch theme preference to preserve styling during repair
    const businessContext = await this.prisma.businessContext.findUnique({ where: { projectId } });
    const brandInputs = businessContext?.brandIdentityInputs as any;
    const themePreference = brandInputs?.themePreference || 'modern-minimalist';



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
              for (const issue of compIssues.issues as any[]) {
                if (issue.issueType === 'CODE' && !existing.issues.includes(issue.description)) {
                  existing.issues.push(issue.description);
                }
              }
              checklist.set(compIssues.componentName, existing);
            }
          }
        }
      }

      if (checklist.size > 0) {
        this.logger.log(`get all the list of components that need to be repair:`);
        this.logger.log(JSON.stringify(Object.fromEntries(checklist), null, 2));
      }

      // Extract Lighthouse Issues
      const globalLighthouseIssues: string[] = [];
      const elementLighthouseIssues: string[] = [];

      if (qcReport && qcReport.lighthouseReports) {
        for (const report of qcReport.lighthouseReports) {
          if (report.issues && report.issues.length > 0) {
            for (const issue of report.issues as any[]) {
              if (issue.snippets && issue.snippets.length > 0) {
                const snippetList = issue.snippets.map((s: string) => `\`${s}\``).join(', ');
                const msg = `[Element-Level PageSpeed Issue] ${issue.title}: ${issue.description}. Failing snippets: ${snippetList}`;
                if (!elementLighthouseIssues.includes(msg)) elementLighthouseIssues.push(msg);
              } else {
                const msg = `[Global PageSpeed SEO Issue] ${issue.title}: ${issue.description}`;
                if (!globalLighthouseIssues.includes(msg)) globalLighthouseIssues.push(msg);
              }
            }
          }
        }
      }

      let hasFixes = false;
      
      const appFiles = [];
      if (globalLighthouseIssues.length > 0) {
        appFiles.push({ name: 'Layout', path: path.join(tmpDir, 'src/app/layout.tsx') });
        appFiles.push({ name: 'Home', path: path.join(tmpDir, 'src/app/page.tsx') });
      }

      for (const file of files) {
        if (!file.endsWith('.tsx') || file === 'index.ts') continue;
        appFiles.push({ name: file.replace('.tsx', ''), path: path.join(componentsDir, file) });
      }

      for (const { name: componentName, path: filePath } of appFiles) {
        let componentCode = '';
        try {
          componentCode = await fs.readFile(filePath, 'utf-8');
        } catch (e) {
          continue; // skip if layout/page doesn't exist
        }

        let combinedIssues: string[] = [];

        if (componentName !== 'Layout' && componentName !== 'Home') {
          // 4. Validate Component against Zod Schema
          this.logger.log(`Validating ${componentName}...`);
          const validationResult = await this.skillExecutor.executeSkill(this.validationSkill, {
            projectId,
            context: { sectionType: componentName, componentCode },
            metadata: { phase: 'repair', componentName }
          });
          
          const critique = validationResult as unknown as ValidationCritique;

          // Phase 2: Execute Repairs
          if (!critique.isValid && critique.missingElements.length > 0) {
            this.logger.warn(`Component ${componentName} failed Zod validation! Missing: ${critique.missingElements.join(', ')}`);
            combinedIssues = combinedIssues.concat(critique.missingElements.map(e => `Missing required zod field: ${e}`));
          }
        }

        if (checklist.has(componentName)) {
          const visualIssues = checklist.get(componentName)!.issues;
          this.logger.warn(`Component ${componentName} has Visual QA issues! ${visualIssues.join(', ')}`);
          combinedIssues = combinedIssues.concat(visualIssues);
        }

        if (componentName === 'Layout' || componentName === 'Home') {
          combinedIssues = combinedIssues.concat(globalLighthouseIssues);
        } else {
          if (elementLighthouseIssues.length > 0) {
            combinedIssues = combinedIssues.concat(elementLighthouseIssues);
          }
        }

        if (combinedIssues.length > 0) {
          const pages = checklist.has(componentName) ? checklist.get(componentName)!.pages : ['/'];
          for (const p of pages) {
            this.logger.log(`Section : ${componentName}, Page : ${formatPageName(p)} Attempt : ${attempt}`);
          }
          this.logger.log(`Fetch to AI the data of what need to be fix! Then the after it's fix!`);
          
          const repairResult = await this.skillExecutor.executeSkill(this.repairSkill, {
            projectId,
            context: { 
              sectionType: componentName, 
              brokenCode: componentCode, 
              critique: combinedIssues,
              themePreference
            },
            metadata: { phase: 'repair', componentName }
          });

          const fixedCode = (repairResult as any).code || repairResult;
          await fs.writeFile(filePath, fixedCode);
          hasFixes = true;
          this.logger.log(`Successfully patched ${componentName} locally.`);
        } else {
          this.logger.log(`Component ${componentName} is valid and has no visual issues.`);
        }
      }

      return hasFixes;
  }
}
