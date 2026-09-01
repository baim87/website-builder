import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PageService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPage(projectId: string, slug: string, content: any, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }

    return this.prisma.page.upsert({
      where: {
        projectId_slug: {
          projectId,
          slug,
        },
      },
      update: {
        content,
      },
      create: {
        projectId,
        slug,
        content,
      },
    });
  }

  async getPagesByProjectId(projectId: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }

    return this.prisma.page.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
