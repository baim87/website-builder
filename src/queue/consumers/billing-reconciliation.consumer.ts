import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { BillingReconciliationJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { BillingService } from '../../billing/billing.service';

@Processor(QUEUE_NAMES.BILLING_RECONCILIATION)
export class BillingReconciliationConsumer extends BaseConsumer<BillingReconciliationJobData> {
  constructor(private readonly billingService: BillingService) {
    super();
  }

  protected async handleJob(job: Job<BillingReconciliationJobData>): Promise<void> {
    if (job.name === 'reconcile-all') {
      await this.billingService.reconcileAllSubscriptions();
    } else if (job.name === 'reconcile') {
      if (job.data.userId && job.data.subscriptionId) {
        await this.billingService.reconcileBilling(job.data.userId, job.data.subscriptionId);
      }
    }
  }
}
