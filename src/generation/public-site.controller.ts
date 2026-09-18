import { Controller, Get, Param, NotFoundException, Headers, UnauthorizedException } from '@nestjs/common';
import { SiteContentService } from './site-content.service';

@Controller('public/site-content')
export class PublicSiteController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Get(':projectId')
  async getSiteContent(
    @Param('projectId') projectId: string,
    @Headers('x-builder-api-key') apiKey: string,
  ) {
    if (process.env.BUILDER_API_SECRET && apiKey !== process.env.BUILDER_API_SECRET) {
      throw new UnauthorizedException('Invalid API Key');
    }

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
