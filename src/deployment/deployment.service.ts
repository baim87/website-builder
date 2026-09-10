import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VercelClient } from '../vercel/vercel.client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelClient: VercelClient,
    @InjectQueue(QUEUE_NAMES.DEPLOYMENT_TRACKER) private readonly deploymentTrackerQueue: Queue
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
    await this.linkProjectToGithub(projectId, userId, githubRepoOwner, githubRepoName);
    return this.waitForDeployment(projectId, userId, githubRepoName);
  }

  async linkProjectToGithub(projectId: string, userId: string, githubRepoOwner: string, githubRepoName: string) {
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
    return result;
  }

  async waitForDeployment(projectId: string, userId: string, vercelProjectName: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Set initial status to Deploying
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'DEPLOYING' }, // Or whatever intermediate status you use
    });

    this.logger.log(`Queueing deployment tracker job for ${vercelProjectName}...`);
    
    await this.deploymentTrackerQueue.add('track', {
      projectId,
      userId,
      vercelProjectName,
      attempts: 0
    }, {
      delay: 3000 // Initial delay to give Vercel time to start the build
    });

    // If custom domain is set, use it. Otherwise, we'll give the default format.
    let liveUrl = project.domain?.domainName ? `https://${project.domain.domainName}` : `https://${vercelProjectName}.vercel.app`;

    return {
      success: true,
      deploymentId: 'linked',
      status: 'DEPLOYING',
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
