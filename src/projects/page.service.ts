import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPageDto } from './dto/upsert-page.dto';
import { RevalidationService } from './revalidation.service';

@Injectable()
export class PageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidationService: RevalidationService
  ) {}

  async upsertPage(projectId: string, slug: string, pageData: UpsertPageDto, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });
    if (!project) throw new ForbiddenException(`Project ${projectId} not found or access denied`);

    const result = await this.prisma.page.upsert({
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
        status: pageData.status,
      },
      create: {
        projectId,
        slug,
        content: pageData.content,
        componentCode: pageData.componentCode,
        seoMeta: pageData.seoMeta,
        keywordTarget: pageData.keywordTarget,
        status: pageData.status,
      },
    });

    // Trigger on-demand ISR revalidation
    this.revalidationService.triggerRevalidation(projectId).catch(() => {});

    return result;
  }

  async getPagesByProjectId(projectId: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new ForbiddenException(`Project ${projectId} not found or access denied`);
    }

    return this.prisma.page.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    });
  }
}
