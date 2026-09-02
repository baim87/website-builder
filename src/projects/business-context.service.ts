import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessContextDto } from './dto/update-business-context.dto';
import { LocationMetricsService } from '../seo/location-metrics.service';

@Injectable()
export class BusinessContextService {
  private readonly logger = new Logger(BusinessContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locationMetrics: LocationMetricsService,
  ) {}

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

    if (rest.radius !== undefined) {
      if (typeof rest.radius === 'string') {
        const parsed = parseInt(String(rest.radius).replace(/[^0-9]/g, ''), 10);
        rest.radius = isNaN(parsed) ? 50 : parsed;
      }
    }

    // Run background location metrics process if location and services exist
    const finalContext = await this.prisma.businessContext.upsert({
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

    if (finalContext.location && finalContext.services) {
      const servicesArray = Array.isArray(finalContext.services) ? finalContext.services : [];
      if (servicesArray.length > 0) {
        // Fire and forget
        this.locationMetrics.processProjectMetrics(
          projectId, 
          finalContext.location, 
          finalContext.radius || 50, 
          servicesArray as string[]
        ).catch(e => {
          this.logger.error(`Failed to process background location metrics for project ${projectId}`, e.stack);
        });
      }
    }

    return finalContext;
  }
}
