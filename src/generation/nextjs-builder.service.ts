import { Injectable, Logger } from '@nestjs/common';
import { Page } from '@prisma/client';
import { BusinessContextService } from '../projects/business-context.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { PageService } from '../projects/page.service';
import { DesignSystem } from '../skills/schemas/skill-outputs.schema';
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

      // 2. Write global CSS
      const designTokens = websiteData?.designTokens as DesignSystem | undefined;
      if (designTokens?.globalCss) {
        this.logger.log('Writing AI-generated globals.css');
        await fs.writeFile(path.join(tempDir, 'src/app/globals.css'), designTokens.globalCss);
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

      // 6. Deploy directly to Vercel via CLI (bypasses GitHub integration requirement)
      const vercelToken = process.env.VERCEL_API_TOKEN;
      const vercelTeamId = process.env.VERCEL_TEAM_ID;
      let vercelUrl = `https://${repoName}.vercel.app`;

      if (vercelToken) {
        try {
          this.logger.log(`Deploying to Vercel via CLI...`);
          const teamFlag = vercelTeamId ? `--scope ${vercelTeamId}` : '';
          const { stdout } = await execAsync(
            `npx -y vercel deploy --prod --yes --token ${vercelToken} ${teamFlag} --name ${repoName}`,
            { cwd: tempDir, env: { ...process.env, NODE_ENV: 'production' } }
          );
          
          // Vercel CLI prints the deployment URL as the last line
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1].trim();
          if (lastLine.startsWith('https://')) {
            vercelUrl = lastLine;
          }
          this.logger.log(`Vercel deployment live at: ${vercelUrl}`);
        } catch (vercelErr: any) {
          this.logger.warn(`Vercel CLI deploy failed: ${vercelErr.message}. GitHub push succeeded — import manually if needed.`);
        }
      } else {
        this.logger.warn(`VERCEL_API_TOKEN not set — skipping Vercel deploy. GitHub push succeeded.`);
      }

      return { repoOwner: repo.owner, repoName, cloneUrl: repo.clone_url, vercelUrl };

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

