import { Injectable, Logger } from '@nestjs/common';
import { Page } from '@prisma/client';
import { BusinessContextService } from '../projects/business-context.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { PageService } from '../projects/page.service';
import { GithubService } from '../deployment/github.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { CodeRepairSkill } from '../skills/impl/code-repair.skill';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { PrismaService } from '../prisma/prisma.service';

const execAsync = promisify(exec);

@Injectable()
export class NextjsBuilderService {
  private readonly logger = new Logger(NextjsBuilderService.name);

  constructor(
    private readonly businessContextService: BusinessContextService,
    private readonly websiteDataService: WebsiteDataService,
    private readonly pageService: PageService,
    private readonly githubService: GithubService,
    private readonly codeRepair: CodeRepairSkill,
    private readonly skillExecutor: SkillExecutorService,
    private readonly prisma: PrismaService,
  ) {}

  async buildAndDeploy(projectId: string, userId?: string): Promise<any> {
    this.logger.log(`Starting Next.js build and deploy for project ${projectId}`);
    
    const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
    const tempId = crypto.randomUUID();
    const tempDir = path.join('/tmp', `builder-${tempId}`);
    
    const templateRepoUrl = process.env.TEMPLATE_REPO_URL;
    
    try {
      if (!templateRepoUrl) {
         throw new Error('TEMPLATE_REPO_URL environment variable is not set. Please set it to your site-template Git repository URL.');
      }
      
      this.logger.log(`Cloning template from ${templateRepoUrl} to ${tempDir}`);
      await execAsync(`git clone ${templateRepoUrl} ${tempDir}`);
      
      // Remove the .git folder from the cloned template so it's fresh for the new project
      await execAsync(`rm -rf ${tempDir}/.git`);

      this.logger.log(`Installing dependencies in ${tempDir}...`);
      await execAsync(`npm install --no-audit --no-fund`, { cwd: tempDir });

      // 1. Backup original hardcoded components for fallback
      const componentsDir = path.join(tempDir, 'src/components');
      const backupDir = path.join(tempDir, 'src/components_backup');
      await execAsync(`cp -R ${componentsDir} ${backupDir}`);

      const websiteData = await this.websiteDataService.findByProjectId(projectId);
      const pages = await this.pageService.getPagesByProjectId(projectId);
      const assets = await this.prisma.asset.findMany({ where: { projectId } });
      const logoAsset = assets.find((a: any) => a.purpose === 'logo' || a.type === 'image');

      // 2. Inject CSS Variables into globals.css
      const designTokens = websiteData?.designTokens as any;
      if (designTokens?.colors && designTokens?.typography) {
        this.logger.log('Injecting CSS variables into globals.css');
        
        const hexToHsl = (hex: string) => {
          if (!hex) return '0 0% 0%';
          hex = hex.replace(/^#/, '');
          if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2;
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }
          return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
        };

        const computeContrastColor = (hex: string) => {
          if (!hex) return '#ffffff';
          hex = hex.replace(/^#/, '');
          if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return luminance > 0.5 ? '#000000' : '#ffffff';
        };

        const cssVars = `
:root {
  --background: ${hexToHsl(designTokens.colors.background || '#ffffff')};
  --foreground: ${hexToHsl(designTokens.colors.foreground || designTokens.colors.text || '#000000')};
  --primary: ${hexToHsl(designTokens.colors.primary || '#18181b')};
  --primary-foreground: ${hexToHsl(designTokens.colors.primaryForeground || computeContrastColor(designTokens.colors.primary || '#18181b'))};
  --secondary: ${hexToHsl(designTokens.colors.secondary || '#f4f4f5')};
  --secondary-foreground: ${hexToHsl(designTokens.colors.secondaryForeground || computeContrastColor(designTokens.colors.secondary || '#f4f4f5'))};
  --accent: ${hexToHsl(designTokens.colors.accent || '#f4f4f5')};
  --accent-foreground: ${hexToHsl(designTokens.colors.accentForeground || computeContrastColor(designTokens.colors.accent || '#f4f4f5'))};
  --font-heading: "${designTokens.typography.headingFont || 'Inter'}";
  --font-body: "${designTokens.typography.bodyFont || 'Inter'}";
}
`;
        const globalsPath = path.join(tempDir, 'src/app/globals.css');
        let existingCss = '';
        try {
          existingCss = await fs.readFile(globalsPath, 'utf-8');
        } catch (e) {
          this.logger.warn('No globals.css found in template, creating a new one.');
        }
        await fs.writeFile(globalsPath, `${cssVars}\n${existingCss}`);
      }
      
      const layoutPage = pages.find((p: Page) => p.slug === 'layout');
      const headerSection = (layoutPage?.content as any[])?.find(s => s.type === 'HeaderSection');
      const footerSection = (layoutPage?.content as any[])?.find(s => s.type === 'FooterSection');

      const siteContent = {
        designTokens: websiteData?.designTokens || {},
        seoMetadata: websiteData?.seoMetadata || {},
        business: {
          name: businessContext.businessName || '',
          phone: businessContext.phone || '',
          email: businessContext.email || '',
          address: businessContext.businessAddress || '',
          tagline: '',
          logoUrl: logoAsset?.url || ''
        },
        layout: {
          header: headerSection || null,
          footer: footerSection || null,
        },
        pages: pages.filter((p: Page) => p.slug !== 'layout').map((p: Page) => ({ slug: p.slug, sections: p.content }))
      };
      await fs.writeFile(path.join(tempDir, 'src/data/content.json'), JSON.stringify(siteContent, null, 2));

      // 4. Write Generated Components and Self-Healing Build Loop
      const customComponents = (websiteData?.customComponents as Record<string, string>) || {};
      const generatedDir = path.join(tempDir, 'src/components/generated');
      await fs.mkdir(generatedDir, { recursive: true });
      
      let indexTsContent = '';
      for (const [compName, compCode] of Object.entries(customComponents)) {
        await fs.writeFile(path.join(generatedDir, `${compName}.tsx`), compCode);
        indexTsContent += `export { default as ${compName} } from './${compName}';\n`;
      }
      await fs.writeFile(path.join(generatedDir, 'index.ts'), indexTsContent);

      this.logger.log(`Running build in ${tempDir} to verify generated code...`);
      
      let buildSuccess = false;
      let retries = 0;
      const MAX_RETRIES = 3;

      while (!buildSuccess && retries <= MAX_RETRIES) {
        try {
          await execAsync(`npm run build`, { 
            cwd: tempDir, 
            env: { ...process.env, NODE_ENV: 'production' } 
          });
          buildSuccess = true;
          this.logger.log(`Build successful on attempt ${retries + 1}`);
        } catch (error: any) {
          if (retries === MAX_RETRIES) {
            throw new Error(`Next.js build failed after ${MAX_RETRIES} repair attempts: ${error.message}`);
          }
          this.logger.warn(`Build failed (Attempt ${retries + 1}). Engaging Self-Healing loop...`);
          
          const errorLog = error.stdout + '\n' + error.stderr;
          
          // Try to extract the file name from the error
          const match = errorLog.match(/src\/components\/generated\/([a-zA-Z0-9_]+)\.tsx/);
          if (match && match[1]) {
            const brokenCompName = match[1];
            this.logger.warn(`Broken component detected: ${brokenCompName}. Running CodeRepairSkill...`);
            
            const brokenCode = await fs.readFile(path.join(generatedDir, `${brokenCompName}.tsx`), 'utf-8');
            
            const repairResult = await this.skillExecutor.executeSkill(this.codeRepair, {
              projectId,
              context: { brokenCode, errorLog, componentName: brokenCompName }
            });
            
            const fixedCode = repairResult.code;
            
            // Overwrite in temp file system
            await fs.writeFile(path.join(generatedDir, `${brokenCompName}.tsx`), fixedCode);
            
            // Save permanently back to database
            customComponents[brokenCompName] = fixedCode;
            await this.websiteDataService.upsert(projectId, {
               customComponents
            });
            
            this.logger.log(`Applied fix to ${brokenCompName}. Retrying build...`);
          } else {
            this.logger.warn(`Could not identify the broken component from error log. Proceeding with build failure.`);
            throw error; // If we can't figure out which file broke, we can't heal it.
          }
          retries++;
        }
      }

      // 5. Create GitHub Repository and Push
      const projectNameSlug = businessContext.businessName 
        ? businessContext.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
        : `project-${projectId.substring(0, 8)}`;
      const repoName = `${projectNameSlug}-${projectId.substring(0, 4)}`;

      this.logger.log(`Ensuring GitHub repository exists: ${repoName}`);
      const repo = await this.githubService.ensureRepository(repoName);

      this.logger.log(`Committing and pushing code to GitHub repo: ${repoName}`);
      await this.githubService.commitAndPush(repoName, tempDir);

      this.logger.log(`Successfully pushed codebase to GitHub: ${repo.clone_url}`);

      return { repoOwner: repo.owner, repoName, cloneUrl: repo.clone_url };

    } catch (error: any) {
      this.logger.error(`Failed to build and push project ${projectId}`, error.stack);
      throw error;
    } finally {
      this.logger.log(`Cleaning up temporary directory ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => 
        this.logger.warn(`Failed to cleanup temp dir: ${err.message}`)
      );
    }
  }
}

