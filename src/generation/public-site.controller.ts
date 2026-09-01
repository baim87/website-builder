import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SiteContentService } from './site-content.service';

@Controller('public/site-content')
export class PublicSiteController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Get(':projectId')
  async getSiteContent(@Param('projectId') projectId: string) {
    try {
      const content = await this.siteContentService.getSiteContent(projectId);
      if (!content) {
        throw new NotFoundException(`Site content not found for project ${projectId}`);
      }
      return content;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(`Could not load site content for project ${projectId}`);
    }
  }
}
