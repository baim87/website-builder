import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSiteContent(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websiteData: true,
        businessContext: true,
        pages: true,
        assets: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const faviconAsset = project.assets.find(a => a.purpose === 'favicon');

    // Map Prisma structure to SiteContent
    const siteContent = {
      pages: project.pages.map((p) => ({
        slug: p.slug,
        sections: p.content, // Assuming content is SectionData[]
      })),
      designTokens: project.websiteData?.designTokens || undefined,
      seoMetadata: project.websiteData?.seoMetadata || undefined,
      layout: undefined, // Add layout if stored in websiteData.customComponents etc.
      business: project.businessContext ? {
        name: project.businessContext.businessName,
        phone: project.businessContext.phone,
        email: project.businessContext.email,
        address: project.businessContext.businessAddress,
        faviconUrl: faviconAsset?.url || undefined,
      } : undefined,
    };

    // Note: Fallbacks or additional fields can be populated here if necessary
    return siteContent;
  }
}
