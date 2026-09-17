import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { AnalyticsProvisioningJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { AnalyticsService } from '../../analytics/analytics.service';
import { DeploymentService } from '../../deployment/deployment.service';
import { SiteContentService } from '../../generation/site-content.service';

@Processor(QUEUE_NAMES.ANALYTICS_PROVISIONING)
export class AnalyticsProvisioningConsumer extends BaseConsumer<AnalyticsProvisioningJobData> {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly deploymentService: DeploymentService,
    private readonly siteContentService: SiteContentService
  ) {
    super();
  }

  protected async handleJob(job: Job<AnalyticsProvisioningJobData>): Promise<void> {
    const { projectId, domain, userId } = job.data;
    
    // 1. Provision Analytics (GA/GTM)
    await this.analyticsService.provisionAnalytics(projectId, domain);
    
    // 2. Invalidate the backend Redis cache so the next request gets the new GTM ID
    await this.siteContentService.invalidateCache(projectId);
    
    // 3. Trigger ISR Revalidation on the frontend Vercel site
    try {
      await this.deploymentService.revalidateProject(projectId, userId, '/');
      console.log(`Successfully triggered ISR revalidation for project ${projectId} on domain ${domain}`);
    } catch (error) {
      console.error(`Failed to trigger ISR revalidation for project ${projectId}:`, error);
    }
  }
}
