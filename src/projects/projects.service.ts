import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        businessContext: {
          create: {
            trade: dto.trade,
          },
        },
      },
      include: {
        businessContext: true,
      },
    });
  }

  async findAll(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        assets: {
          where: {
            purpose: { in: ['favicon', 'logo'] }
          }
        }
      }
    });

    return projects.map(p => ({
      ...p,
      faviconUrl: p.assets.find(a => a.purpose === 'favicon')?.url,
      logoUrl: p.assets.find(a => a.purpose === 'logo')?.url,
    }));
  }

  async findLatestStatus(userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        websiteData: true,
      },
    });

    if (!project) {
      return { status: 'no_project' };
    }

    return {
      id: project.id,
      status: project.status, // e.g. 'draft', 'onboarding', 'generating', 'completed'
      generationStatus: project.websiteData?.generationStatus,
    };
  }

  async findOne(id: string, userId?: string) {
    const whereClause: any = { id };
    if (userId) {
      whereClause.userId = userId;
    }

    const project = await this.prisma.project.findUnique({
      where: whereClause,
      include: {
        businessContext: true,
        websiteData: true,
        domain: true,
        assets: {
          where: {
            purpose: { in: ['favicon', 'logo'] }
          }
        }
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return {
      ...project,
      faviconUrl: project.assets.find(a => a.purpose === 'favicon')?.url,
      logoUrl: project.assets.find(a => a.purpose === 'logo')?.url,
    };
  }

  async delete(id: string, userId?: string) {
    try {
      const whereClause: any = { id };
      if (userId) {
        whereClause.userId = userId;
      }
      const project = await this.prisma.project.delete({
        where: whereClause,
      });

      // Delete project files in R2 storage
      const projectFolderPrefix = `users/${project.userId}/projects/${project.id}/`;
      await this.storageService.deleteDirectory(projectFolderPrefix);

      return { success: true };
    } catch (e) {
      throw new NotFoundException(`Project ${id} not found or you don't have access`);
    }
  }
}
