import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from '@prisma/client';
import { BusinessContextService } from '../projects/business-context.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { PageService } from '../projects/page.service';
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
    
    // 1. Fetch data (just to get businessContext for the project slug)
    const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
    
    // 2. Prepare workspace
    const tempId = crypto.randomUUID();
    const tempDir = path.join('/tmp', `builder-${tempId}`);
    
    // Locate site-template (relative to backend execution context)
    // Locally it's at ../site-template from backend root. In Docker it might be at /app/site-template
    const isDocker = process.env.NODE_ENV === 'production';
    const templateDir = isDocker 
      ? path.join(process.cwd(), '../site-template') // Ensure Dockerfile copies it here
      : path.join(process.cwd(), '../site-template');
    
    try {
      this.logger.log(`Cloning template from ${templateDir} to ${tempDir}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      // We only copy necessary files, avoiding node_modules and .next
      await execAsync(`rsync -a --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'dist' ${templateDir}/ ${tempDir}/`);

      // 3. Inject static data as fallback since Vercel cannot reach localhost during build
      const websiteData = await this.websiteDataService.findByProjectId(projectId);
      const pages = await this.pageService.getPagesByProjectId(projectId);
      
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
      
      const contentJsonPath = path.join(tempDir, 'src/data/content.json');
      await fs.writeFile(contentJsonPath, JSON.stringify(siteContent, null, 2));

      // 4. Execute Vercel CLI
      const vercelToken = this.configService.get<string>('VERCEL_API_TOKEN');
      if (!vercelToken) {
        throw new Error('VERCEL_API_TOKEN is not configured');
      }

      // Format project name (lowercase, alphanumeric, hyphens)
      const projectNameSlug = businessContext.businessName 
        ? businessContext.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
        : `project-${projectId.substring(0, 8)}`;
        
      const finalProjectName = `${projectNameSlug}-${projectId.substring(0, 4)}`;

      this.logger.log(`Deploying to Vercel project: ${finalProjectName}`);
      
      const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';

      // Run deployment
      // --prod deploys to production, --yes skips prompts, --token authenticates
      // We pass the API URL and Project ID as build env variables so Next.js can fetch data
      const deployCommand = `npx --yes vercel deploy --prod --yes --token ${vercelToken} --name ${finalProjectName} --build-env NEXT_PUBLIC_API_URL=${apiUrl} --build-env NEXT_PUBLIC_PROJECT_ID=${projectId}`;
      
      const { stdout, stderr } = await execAsync(deployCommand, { cwd: tempDir });
      
      if (stderr && !stderr.includes('Inspect')) {
        this.logger.warn(`Vercel CLI output (stderr): ${stderr}`);
      }
      
      // Parse the output URL
      // Vercel CLI outputs the URL directly on success (e.g. https://project-name.vercel.app)
      const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
      const liveUrl = urlMatch ? urlMatch[0] : stdout.trim();
      
      this.logger.log(`Deployment successful! Live URL: ${liveUrl}`);
      
      return liveUrl;

    } catch (error: any) {
      this.logger.error(`Failed to build and deploy project ${projectId}`, error.stack);
      throw error;
    } finally {
      // 5. Cleanup
      this.logger.log(`Cleaning up temporary directory ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => 
        this.logger.warn(`Failed to cleanup temp dir: ${err.message}`)
      );
    }
  }
}
