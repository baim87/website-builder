import { Injectable, Logger } from '@nestjs/common';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { CopywritingRepairSkill } from '../skills/impl/copywriting-repair.skill';
import { QCReport } from '../quality-control/quality-control.service';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class CopywritingRepairService {
  private readonly logger = new Logger(CopywritingRepairService.name);

  constructor(
    private readonly skillExecutor: SkillExecutorService,
    private readonly repairSkill: CopywritingRepairSkill,
  ) {}

  async repair(projectId: string, tmpDir: string, qcReport: QCReport, _attempt: number = 1): Promise<boolean> {
    const timestamp = new Date().toISOString();
    this.logger.log(`[${projectId} - ${timestamp}] Starting Git-Centric Copywriting Repair Loop`);

    const contentPath = path.join(tmpDir, 'src/data/content.json');
    let contentJsonStr: string;
    let contentData: any;
    try {
      contentJsonStr = await fs.readFile(contentPath, 'utf-8');
      contentData = JSON.parse(contentJsonStr);
    } catch (e) {
      this.logger.warn(`Could not read/parse content.json at ${contentPath}`);
      return false;
    }

    // Build the Repair Checklist for COPYWRITING issues
    const checklist = new Map<string, string[]>();
    if (qcReport && qcReport.visualCritiques) {
      for (const vCritique of qcReport.visualCritiques) {
        for (const compIssues of vCritique.issues) {
          for (const issue of compIssues.issues as any[]) {
            if (issue.issueType === 'COPYWRITING') {
              const existing = checklist.get(compIssues.componentName) || [];
              if (!existing.includes(issue.description)) {
                existing.push(issue.description);
              }
              checklist.set(compIssues.componentName, existing);
            }
          }
        }
      }
    }

    if (checklist.size === 0) {
      this.logger.log(`No components needed copywriting repair.`);
      return false;
    }

    let hasFixes = false;

    // Traverse the NextJS content JSON to find the matching sections
    // Layout sections (header, footer)
    if (contentData.layout) {
      for (const sectionKey of ['header', 'footer']) {
        const componentName = sectionKey === 'header' ? 'HeaderSection' : 'FooterSection';
        if (contentData.layout[sectionKey] && checklist.has(componentName) && contentData.layout[sectionKey].ast?.props?.data) {
           const fixed = await this.repairSection(projectId, componentName, contentData.layout[sectionKey].ast.props.data, checklist.get(componentName)!);
           if (fixed) {
             contentData.layout[sectionKey].ast.props.data = fixed;
             hasFixes = true;
           }
        }
      }
    }

    // Pages sections
    if (contentData.pages) {
      for (const page of contentData.pages) {
        if (!page.sections) continue;
        for (let i = 0; i < page.sections.length; i++) {
          const section = page.sections[i];
          const componentName = section.type;
          if (checklist.has(componentName) && section.ast?.props?.data) {
            const fixed = await this.repairSection(projectId, componentName, section.ast.props.data, checklist.get(componentName)!);
            if (fixed) {
              page.sections[i].ast.props.data = fixed;
              hasFixes = true;
            }
          }
        }
      }
    }

    if (hasFixes) {
      await fs.writeFile(contentPath, JSON.stringify(contentData, null, 2));
      this.logger.log(`Successfully patched content.json locally.`);
    }

    return hasFixes;
  }

  private async repairSection(projectId: string, componentName: string, brokenData: any, critique: string[]): Promise<any> {
    this.logger.log(`Repairing copywriting for ${componentName}... Issues: ${critique.join(', ')}`);
    const repairResult = await this.skillExecutor.executeSkill(this.repairSkill, {
      projectId,
      context: { 
        sectionType: componentName, 
        brokenData, 
        critique 
      },
      metadata: { phase: 'repair', componentName }
    });

    return repairResult?.fixedData || repairResult;
  }
}
