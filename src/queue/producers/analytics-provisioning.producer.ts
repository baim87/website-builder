import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { AnalyticsProvisioningJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class AnalyticsProvisioningProducer extends BaseProducer<AnalyticsProvisioningJobData> {
  constructor(
    @InjectQueue(QUEUE_NAMES.ANALYTICS_PROVISIONING) protected readonly queue: Queue<AnalyticsProvisioningJobData>,
  ) {
    super();
  }

  async provisionAnalytics(projectId: string, domain: string, userId: string) {
    this.logger.log(`Queueing analytics provisioning for ${domain}`);
    return this.addJob('provision', { projectId, domain, userId }, { attempts: 3 });
  }
}
