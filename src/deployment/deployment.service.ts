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
