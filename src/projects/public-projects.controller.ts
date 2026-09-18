import { Controller, Get, Param, Headers, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SiteContentService } from '../generation/site-content.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('public/projects')
export class PublicProjectsController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Public()
  @Get(':id/content')
  async getProjectContent(
    @Param('id') projectId: string,
    @Headers('x-builder-api-key') apiKey?: string
  ) {
    const secret = process.env.BUILDER_API_SECRET;
    
    // If the backend has a secret configured, enforce it.
    if (secret) {
      if (!apiKey) {
        throw new UnauthorizedException('Missing x-builder-api-key header');
      }
      if (apiKey !== secret) {
        throw new ForbiddenException('Invalid x-builder-api-key header');
      }
    }

    return this.siteContentService.getSiteContent(projectId);
  }
}
