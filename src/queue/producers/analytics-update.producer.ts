import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class AnalyticsUpdateProducer {
  private readonly logger = new Logger(AnalyticsUpdateProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.ANALYTICS_UPDATE) private readonly updateQueue: Queue,
  ) {}

  async updateAnalyticsDomain(projectId: string, newDomainName: string, userId: string) {
    this.logger.log(`Dispatching analytics update job for project ${projectId} to domain ${newDomainName}`);

    await this.updateQueue.add(
      'update-domain',
      { projectId, newDomainName, userId },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
