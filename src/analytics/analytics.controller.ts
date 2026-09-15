import { Controller, Get, Post, Param, UseGuards, Request, Body, HttpStatus, HttpException, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AnalyticsProvisioningProducer } from '../queue/producers/analytics-provisioning.producer';
import { ANALYTICS_STATUS } from './constants/analytics-status.constant';

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
    @Query('period') period: string,
    @Request() req: any,
  ) {
    const timePeriod = period || '30d';
    return this.analyticsService.getAnalyticsSummary(projectId, req.user.id, timePeriod);
  }

  @Post('provision')
  async provision(
    @Param('projectId') projectId: string,
    @Body('domainName') domainName: string,
    @Request() req: any,
  ) {
    if (!domainName) {
      throw new HttpException('Domain name is required to provision analytics', HttpStatus.BAD_REQUEST);
    }
    
    // Add job to BullMQ via the producer
    await this.analyticsProducer.provisionAnalytics(projectId, domainName, req.user.id);
    
    return { status: ANALYTICS_STATUS.ACCEPTED, message: 'Analytics provisioning has been queued and will complete in the background.' };
  }
}
