import { Controller, Get, Post, Param, UseGuards, Request, Body, HttpStatus, HttpException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyticsProvisioningProducer } from '../queue/producers/analytics-provisioning.producer';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsProducer: AnalyticsProvisioningProducer,
  ) {}

  @Get('summary')
  async getSummary(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.analyticsService.getAnalyticsSummary(projectId, req.user.id);
  }

  @Post('provision')
  async provision(
    @Param('projectId') projectId: string,
    @Body('domainName') domainName: string,
  ) {
    if (!domainName) {
      throw new HttpException('Domain name is required to provision analytics', HttpStatus.BAD_REQUEST);
    }
    
    // Add job to BullMQ via the producer
    await this.analyticsProducer.provisionAnalytics(projectId, domainName);
    
    return { status: 'ACCEPTED', message: 'Analytics provisioning has been queued and will complete in the background.' };
  }
}
