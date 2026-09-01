import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
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
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async delete(id: string, userId?: string) {
    try {
      const whereClause: any = { id };
      if (userId) {
        whereClause.userId = userId;
      }
      await this.prisma.project.delete({
        where: whereClause,
      });
      return { success: true };
    } catch (e) {
      throw new NotFoundException(`Project ${id} not found or you don't have access`);
    }
  }
}
