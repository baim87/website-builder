import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from './revalidation.service';

@Injectable()
export class WebsiteDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidationService: RevalidationService
  ) {}

  async findByProjectId(projectId: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new ForbiddenException(`Project ${projectId} not found or access denied`);
    }

    const data = await this.prisma.websiteData.findUnique({
      where: { projectId },
    });
    
    if (!data) {
      throw new NotFoundException(`Website data for project ${projectId} not found`);
    }
    
    return data;
  }

  async upsert(projectId: string, data: any, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });
    if (!project) throw new ForbiddenException(`Project ${projectId} not found or access denied`);
    
    const result = await this.prisma.websiteData.upsert({
      where: { projectId },
      update: { ...data },
      create: { projectId, ...data },
    });

    // Trigger on-demand ISR revalidation
    this.revalidationService.triggerRevalidation(projectId).catch(() => {});

    return result;
  }
  
  async updateGenerationStatus(projectId: string, status: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });
    if (!project) throw new ForbiddenException(`Project ${projectId} not found or access denied`);
    
    return this.prisma.websiteData.upsert({
      where: { projectId },
      update: { generationStatus: status },
      create: { projectId, generationStatus: status },
    });
  }

  async acquireGenerationLock(projectId: string, userId: string, jobId: string) {
    // Ensure the WebsiteData row exists before attempting to lock
    await this.prisma.websiteData.upsert({
      where: { projectId },
      create: { projectId, generationStatus: 'idle' },
      update: {},
    });

    const result = await this.prisma.websiteData.updateMany({
      where: { 
        projectId, 
        project: { userId },
        OR: [
          { generationStatus: { not: 'generating' } },
          { generationJobId: jobId }
        ]
      },
      data: { generationStatus: 'generating', generationJobId: jobId }
    });
    
    if (result.count === 0) {
      throw new ConflictException('Another generation job is already running or project not found/denied.');
    }
  }

  async releaseGenerationLock(projectId: string, userId: string, status: string) {
    const result = await this.prisma.websiteData.updateMany({
      where: { projectId, project: { userId } },
      data: { generationStatus: status, generationJobId: null }
    });
    if (result.count === 0) {
       throw new ForbiddenException(`Failed to release lock. Project ${projectId} not found or access denied`);
    }
  }
}
