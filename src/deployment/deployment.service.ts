import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VercelClient } from '../vercel/vercel.client';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelClient: VercelClient,
  ) {}

  async deployProject(projectId: string, userId: string) {
    this.logger.log(`Deploying project ${projectId} for user ${userId}`);

    // Verify ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Identify primary domain or fallback to a default subdomain
    const primaryDomain = project.domain?.domainName 
      || `${project.id}.yourplatform.com`;

    // 1. Add Domain to Vercel (if not already added)
    await this.vercelClient.addDomain(primaryDomain);

    // 2. Since it's multi-tenant, "deploy" just means making sure the site is live. 
    // We update the DB status.
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'PUBLISHED' },
    });

    // 3. Revalidate the cache so the newest data appears instantly
    await this.vercelClient.revalidate('/', primaryDomain);

    return {
      success: true,
      deploymentId: 'live-multi-tenant',
      status: 'READY',
      url: `https://${primaryDomain}`,
      project: updatedProject,
    };
  }

  async deployProjectFromGithub(projectId: string, userId: string, githubRepoOwner: string, githubRepoName: string) {
    this.logger.log(`Deploying project ${projectId} for user ${userId} from GitHub repo ${githubRepoOwner}/${githubRepoName}`);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    
    // Create Vercel project linked to GitHub
    const vercelProjectName = `${githubRepoName}`;
    const result = await this.vercelClient.createProjectFromGithub(vercelProjectName, githubRepoOwner, githubRepoName);

    // If custom domain is set, use it. Otherwise, we'll poll Vercel for the exact URL.
    let liveUrl = project.domain?.domainName ? `https://${project.domain.domainName}` : null;
    
    // Poll Vercel for the latest deployment to finish and get the true URL
    let deploymentStatus = 'generating';
    let maxRetries = 40; // Wait up to 2 minutes (3s * 40)
    
    while (!liveUrl && maxRetries > 0) {
      await new Promise(res => setTimeout(res, 3000));
      maxRetries--;
      
      try {
        const deployRes = await this.vercelClient.getProjectDeployments(vercelProjectName);
        if (deployRes && deployRes.deployments && deployRes.deployments.length > 0) {
          const latestDeploy = deployRes.deployments[0];
          deploymentStatus = latestDeploy.readyState; // e.g. 'READY', 'ERROR', 'BUILDING'
          
          if (latestDeploy.readyState === 'READY' && latestDeploy.url) {
            liveUrl = `https://${latestDeploy.url}`;
            break;
          } else if (latestDeploy.readyState === 'ERROR') {
            throw new Error('Vercel deployment failed with ERROR state.');
          }
        }
      } catch (err) {
        this.logger.warn(`Polling Vercel API failed: ${err.message}`);
      }
    }

    if (!liveUrl) {
      this.logger.warn('Timed out waiting for Vercel deployment URL. Falling back to default format.');
      liveUrl = `https://${vercelProjectName}.vercel.app`;
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'PUBLISHED' },
    });

    return {
      success: true,
      deploymentId: result.id || 'existing',
      status: 'READY',
      url: liveUrl,
      project: updatedProject,
    };
  }

  async getDeploymentStatus(projectId: string, userId: string) {
    // Verify ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Since we use a single Vercel project with instant ISR updates,
    // the status is functionally always driven by the database state.
    return {
      projectId,
      status: project.status, // e.g., 'PUBLISHED', 'DRAFT'
      ready: project.status === 'PUBLISHED',
    };
  }

  async revalidateProject(projectId: string, userId: string, path: string = '/') {
    // Verify ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const primaryDomain = project.domain?.domainName 
      || `${project.id}.yourplatform.com`;

    const result = await this.vercelClient.revalidate(path, primaryDomain);

    return {
      success: true,
      path,
      domain: primaryDomain,
      result,
    };
  }
}
