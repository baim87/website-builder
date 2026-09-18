import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class BrandExportService {
  private readonly logger = new Logger(BrandExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async generateBrandKit(projectId: string, userId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { businessContext: true, assets: true, websiteData: true },
    });

    if (!project || !project.businessContext) {
      throw new Error('Project or business context not found');
    }

    const ctx = project.businessContext;
    const assets = project.assets;
    const designTokens: any = project.websiteData?.designTokens || {};

    let markdown = `# Brand Kit: ${project.name}\n\n`;
    markdown += `## Identity\n`;
    markdown += `- **Trade**: ${ctx.trade || 'N/A'}\n`;
    markdown += `- **Location**: ${ctx.location || 'N/A'}\n`;
    markdown += `- **Target Audience**: ${ctx.targetAudience || 'N/A'}\n\n`;

    markdown += `## Visuals\n`;
    const colors = designTokens?.colors || {};
    markdown += `- **Primary Color**: ${colors.primary || 'N/A'}\n`;
    markdown += `- **Secondary Color**: ${colors.secondary || 'N/A'}\n\n`;

    const logos = assets.filter(a => a.purpose === 'logo');
    if (logos.length > 0) {
      markdown += `## Assets\n`;
      logos.forEach((logo, i) => {
        markdown += `- **Logo ${i + 1}**: [Download](${logo.url})\n`;
      });
      markdown += '\n';
    }

    markdown += `## Services\n`;
    const services = ctx.services || [];
    if (Array.isArray(services) && services.length > 0) {
      services.forEach((s: any) => {
         markdown += `- ${s.name || s}\n`;
      });
    } else {
      markdown += `No services listed.\n`;
    }

    // Convert string to buffer
    const buffer = Buffer.from(markdown, 'utf-8');
    
    // Upload to R2
    const key = `projects/${projectId}/brand-kit/brand-kit-${Date.now()}.md`;
    const url = await this.storage.upload(key, buffer, 'text/markdown');

    this.logger.log(`Generated and uploaded Brand Kit for project ${projectId} to ${url}`);

    return url;
  }
}
