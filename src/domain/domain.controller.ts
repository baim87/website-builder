import { Controller, Get, Post, Query, Param, Body, UseGuards, Request } from '@nestjs/common';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get('domains/search')
  async search(@Query('query') query: string) {
    if (!query) {
      return { error: 'Query parameter is required' };
    }
    return this.domainService.searchDomain(query);
  }

  @Post('projects/:projectId/domains/purchase')
  async purchase(
    @Param('projectId') projectId: string,
    @Body('domainName') domainName: string,
    @Body('expectedPrice') expectedPrice: number,
    @Request() req: any,
  ) {
    return this.domainService.purchaseDomain(projectId, req.user.id, domainName, expectedPrice);
  }
}
