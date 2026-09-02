import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from '@prisma/client';
import { BusinessContextService } from '../projects/business-context.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { PageService } from '../projects/page.service';
import { DesignSystem } from '../skills/schemas/skill-outputs.schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

@Injectable()
export class NextjsBuilderService {
  private readonly logger = new Logger(NextjsBuilderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly businessContextService: BusinessContextService,
    private readonly websiteDataService: WebsiteDataService,
    private readonly pageService: PageService,
  ) {}

  async buildAndDeploy(projectId: string, userId?: string): Promise<string> {
    this.logger.log(`Starting Next.js build and deploy for project ${projectId}`);
    
    const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
    const tempId = crypto.randomUUID();
    const tempDir = path.join('/tmp', `builder-${tempId}`);
    
    const isDocker = process.env.NODE_ENV === 'production';
    const templateDir = isDocker 
      ? path.join(process.cwd(), '../site-template') 
      : path.join(process.cwd(), '../site-template');
    
    try {
      this.logger.log(`Cloning template from ${templateDir} to ${tempDir}`);
      await fs.mkdir(tempDir, { recursive: true });
      await execAsync(`rsync -a --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'dist' ${templateDir}/ ${tempDir}/`);

      // 1. Backup original hardcoded components for fallback
      const componentsDir = path.join(tempDir, 'src/components');
      const backupDir = path.join(tempDir, 'src/components_backup');
      await execAsync(`cp -R ${componentsDir} ${backupDir}`);

      const websiteData = await this.websiteDataService.findByProjectId(projectId);
      const pages = await this.pageService.getPagesByProjectId(projectId);

      // 2. Write global CSS
      const designTokens = websiteData?.designTokens as DesignSystem | undefined;
      if (designTokens?.globalCss) {
        this.logger.log('Writing AI-generated globals.css');
        await fs.writeFile(path.join(tempDir, 'src/app/globals.css'), designTokens.globalCss);
      }
      
      // 3. Write Site Content JSON
      const siteContent = {
        designTokens: websiteData?.designTokens || {},
        seoMetadata: websiteData?.seoMetadata || {},
        business: {
          name: businessContext.businessName || '',
          phone: businessContext.phone || '',
          email: businessContext.email || '',
          address: businessContext.businessAddress || '',
          tagline: '',
        },
        pages: pages.map((p: Page) => ({ slug: p.slug, sections: p.content }))
      };
      await fs.writeFile(path.join(tempDir, 'src/data/content.json'), JSON.stringify(siteContent, null, 2));


      // 5. BUILD VALIDATION LOOP
      let buildSuccess = false;
      let buildRetries = 0;
      const MAX_RETRIES = 1;

      while (!buildSuccess && buildRetries <= MAX_RETRIES) {
        try {
          this.logger.log(`Running build validation... (Attempt ${buildRetries + 1})`);
          // We run a local build to check for TS/Tailwind errors
          await execAsync('npm install', { cwd: tempDir }); // Install deps first if needed
          await execAsync('npm run build', { cwd: tempDir });
          buildSuccess = true;
          this.logger.log(`Build validation successful!`);
        } catch (error: any) {
          const stderr = error.stderr || error.message;
          this.logger.warn(`Build failed: ${stderr}`);

          if (buildRetries >= MAX_RETRIES) {
            this.logger.error('Max build retries exceeded. Falling back to safe hardcoded components.');
            // Revert all components to backup
            await execAsync(`rm -rf ${componentsDir}`);
            await execAsync(`cp -R ${backupDir} ${componentsDir}`);
            // Revert CSS to original
            await execAsync(`cp ${path.join(templateDir, 'src/app/globals.css')} ${path.join(tempDir, 'src/app/globals.css')}`);
            break;
          }

          buildRetries++;
          

        }
      }

      // 6. Execute Vercel CLI
      const vercelToken = this.configService.get<string>('VERCEL_API_TOKEN');
      if (!vercelToken) throw new Error('VERCEL_API_TOKEN is not configured');

      const projectNameSlug = businessContext.businessName 
        ? businessContext.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
        : `project-${projectId.substring(0, 8)}`;
      const finalProjectName = `${projectNameSlug}-${projectId.substring(0, 4)}`;

      this.logger.log(`Deploying to Vercel project: ${finalProjectName}`);
      const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';

      const deployCommand = `npx --yes vercel deploy --prod --yes --token ${vercelToken} --name ${finalProjectName} --build-env NEXT_PUBLIC_API_URL=${apiUrl} --build-env NEXT_PUBLIC_PROJECT_ID=${projectId}`;
      
      const { stdout, stderr } = await execAsync(deployCommand, { cwd: tempDir });
      
      if (stderr && !stderr.includes('Inspect')) {
        this.logger.warn(`Vercel CLI output (stderr): ${stderr}`);
      }
      
      const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
      const liveUrl = urlMatch ? urlMatch[0] : stdout.trim();
      
      this.logger.log(`Deployment successful! Live URL: ${liveUrl}`);
      return liveUrl;

    } catch (error: any) {
      this.logger.error(`Failed to build and deploy project ${projectId}`, error.stack);
      throw error;
    } finally {
      this.logger.log(`Cleaning up temporary directory ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => 
        this.logger.warn(`Failed to cleanup temp dir: ${err.message}`)
      );
    }
  }
}

