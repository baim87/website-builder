import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { AnalyticsService } from '../../analytics/analytics.service';
import { getErrorMessage } from '../../common/utils/error.util';

@Processor(QUEUE_NAMES.ANALYTICS_UPDATE)
export class AnalyticsUpdateConsumer extends WorkerHost {
  private readonly logger = new Logger(AnalyticsUpdateConsumer.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job<{ projectId: string; newDomainName: string; userId: string }>) {
    this.logger.log(`Processing analytics update job for project ${job.data.projectId} to ${job.data.newDomainName} (Attempt ${job.attemptsMade + 1})`);

    try {
      await this.analyticsService.updateAnalyticsDomain(job.data.projectId, job.data.newDomainName);
      this.logger.log(`Successfully completed analytics update for ${job.data.projectId}`);
    } catch (error) {
      this.logger.error(`Failed analytics update job: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}
