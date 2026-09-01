import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { BillingReconciliationJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class BillingReconciliationProducer extends BaseProducer<BillingReconciliationJobData> implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.BILLING_RECONCILIATION) protected readonly queue: Queue<BillingReconciliationJobData>,
  ) {
    super();
  }

  async onModuleInit() {
    this.logger.log('Registering daily billing reconciliation repeatable job...');
    await this.queue.upsertJobScheduler(
      'daily-billing-reconciliation',
      { pattern: '0 0 * * *' }, // Run daily at midnight
      {
        name: 'reconcile-all',
        data: {},
      }
    );
  }

  async reconcileBilling(userId: string, subscriptionId: string) {
    return this.addJob('reconcile', { userId, subscriptionId }, { attempts: 3 });
  }
}
