import { Injectable, Logger } from '@nestjs/common';
import { PartnerBrandService } from '../assets/partner-brand.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { QCReport } from '../quality-control/quality-control.service';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class BrandRepairService {
  private readonly logger = new Logger(BrandRepairService.name);

  constructor(
    private readonly partnerBrandService: PartnerBrandService,
    private readonly aiService: AIGatewayService,
  ) {}

  async repair(projectId: string, tmpDir: string, qcReport: QCReport, _attempt: number = 1): Promise<boolean> {
    const timestamp = new Date().toISOString();
    this.logger.log(`[${projectId} - ${timestamp}] Starting Git-Centric Brand Repair Loop`);

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

    // Build the Repair Checklist for BRAND issues
    const checklist = new Map<string, { brandName: string, description: string }[]>();
    if (qcReport && qcReport.visualCritiques) {
      for (const vCritique of qcReport.visualCritiques) {
        for (const compIssues of vCritique.issues) {
          for (const issue of compIssues.issues as any[]) {
            if (issue.issueType === 'BRAND' && issue.brandName) {
              const existing = checklist.get(compIssues.componentName) || [];
              if (!existing.some(e => e.brandName === issue.brandName)) {
                existing.push({ brandName: issue.brandName, description: issue.description });
              }
              checklist.set(compIssues.componentName, existing);
            }
          }
        }
      }
    }

    if (checklist.size === 0) {
      this.logger.log(`No components needed brand repair.`);
      return false;
    }

    let hasFixes = false;
    
    // Pages sections
    if (contentData.pages) {
      for (const page of contentData.pages) {
        if (!page.sections) continue;
        for (let i = 0; i < page.sections.length; i++) {
          const section = page.sections[i];
          const componentName = section.type;
          
          if (checklist.has(componentName)) {
            const issues = checklist.get(componentName)!;
            
            // Resolve logos first
            const brandLogoMap = new Map<string, string>();
            for (const issue of issues) {
               const extracted = await this.partnerBrandService.extractSingleBrand(issue.brandName);
               if (extracted) {
                  const url = await this.partnerBrandService.fetchAndCacheLogo(projectId, extracted.domain, extracted.brandName);
                  if (url) {
                    brandLogoMap.set(issue.brandName, url);
                  }
               }
            }
            
            if (brandLogoMap.size > 0) {
               const fixed = await this.repairSection(componentName, section, issues, brandLogoMap);
               if (fixed) {
                 page.sections[i] = fixed;
                 hasFixes = true;
               }
            }
          }
        }
      }
    }

    if (hasFixes) {
      await fs.writeFile(contentPath, JSON.stringify(contentData, null, 2));
      this.logger.log(`Successfully patched content.json with new brand logos locally.`);
    }

    return hasFixes;
  }

  private async repairSection(componentName: string, brokenData: any, issues: {brandName: string, description: string}[], brandLogoMap: Map<string, string>): Promise<any> {
    this.logger.log(`Injecting fixed brand logos into ${componentName}...`);
    
    const prompt = `
You are a senior data structurer.
A visual QA AI found issues with the brand logos in this JSON data for a \`${componentName}\` component.

Critique / Issues:
${issues.map(c => `- ${c.description}`).join('\n')}

We have fetched the CORRECT logo URLs for these brands:
${Array.from(brandLogoMap.entries()).map(([k, v]) => `- ${k} -> ${v}`).join('\n')}

Here is the current broken JSON data for this section:
${JSON.stringify(brokenData, null, 2)}

Your task is to replace the broken image URLs (or \`UNSPLASH:...\` placeholders) with the correct URLs provided above.
Match the correct URL to the correct brand entry in the JSON.
Do NOT change the JSON structure or remove/add keys. Keep the exact same shape.

Return the completely fixed JSON object.
`;

    const response = await this.aiService.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences. Just the raw JSON object that exactly matches the input structure.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 8192,
      responseFormat: 'json'
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`Failed to parse AI repair response: ${response.text}`);
    }
  }
}
