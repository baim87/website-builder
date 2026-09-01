import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { AnalyticsProvisioningJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { AnalyticsService } from '../../analytics/analytics.service';

@Processor(QUEUE_NAMES.ANALYTICS_PROVISIONING)
export class AnalyticsProvisioningConsumer extends BaseConsumer<AnalyticsProvisioningJobData> {
  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  protected async handleJob(job: Job<AnalyticsProvisioningJobData>): Promise<void> {
    await this.analyticsService.provisionAnalytics(job.data.projectId, job.data.domain);
  }
}
