import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebsiteDataService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectId(projectId: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }

    const data = await this.prisma.websiteData.findUnique({
      where: { projectId },
    });
    
    if (!data) {
      throw new NotFoundException(`Website data for project ${projectId} not found`);
    }
    
    return data;
  }

  async upsert(projectId: string, data: any, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }
    return this.prisma.websiteData.upsert({
      where: { projectId },
      update: {
        ...data,
      },
      create: {
        projectId,
        ...data,
      },
    });
  }
  
  async updateGenerationStatus(projectId: string, status: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }
    return this.prisma.websiteData.upsert({
      where: { projectId },
      update: { generationStatus: status },
      create: { projectId, generationStatus: status },
    });
  }
}
