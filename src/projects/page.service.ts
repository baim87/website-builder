import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPageDto } from './dto/upsert-page.dto';

@Injectable()
export class PageService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPage(projectId: string, slug: string, pageData: UpsertPageDto, userId?: string) {
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
        content: pageData.content,
        componentCode: pageData.componentCode,
        seoMeta: pageData.seoMeta,
        keywordTarget: pageData.keywordTarget,
      },
      create: {
        projectId,
        slug,
        content: pageData.content,
        componentCode: pageData.componentCode,
        seoMeta: pageData.seoMeta,
        keywordTarget: pageData.keywordTarget,
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
