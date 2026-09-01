import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessContextDto } from './dto/update-business-context.dto';

@Injectable()
export class BusinessContextService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectId(projectId: string, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }

    const context = await this.prisma.businessContext.findUnique({
      where: { projectId },
    });
    
    if (!context) {
      throw new NotFoundException(`Business context for project ${projectId} not found`);
    }
    
    const brandInputs = context.brandIdentityInputs as any || {};
    
    return {
      ...context,
      primaryColor: brandInputs.primaryColor,
      secondaryColor: brandInputs.secondaryColor,
      fontStyle: brandInputs.fontStyle,
    };
  }

  async upsert(projectId: string, data: UpdateBusinessContextDto, userId?: string) {
    if (userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId, userId },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} not found or access denied`);
    }
    
    // Extract brand fields
    const { primaryColor, secondaryColor, fontStyle, ...rest } = data;
    const hasNewBrand = primaryColor !== undefined || secondaryColor !== undefined || fontStyle !== undefined;
    
    let newBrandIdentityInputs: any = undefined;
    
    if (hasNewBrand) {
      const existing = await this.prisma.businessContext.findUnique({ where: { projectId } });
      const existingBrand = existing?.brandIdentityInputs as any || {};
      
      newBrandIdentityInputs = {
        ...existingBrand,
        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),
        ...(fontStyle !== undefined && { fontStyle }),
      };
    }

    return this.prisma.businessContext.upsert({
      where: { projectId },
      update: {
        ...rest,
        ...(hasNewBrand && { brandIdentityInputs: newBrandIdentityInputs }),
      },
      create: {
        projectId,
        ...rest,
        ...(hasNewBrand && { brandIdentityInputs: newBrandIdentityInputs }),
      },
    });
  }
}
