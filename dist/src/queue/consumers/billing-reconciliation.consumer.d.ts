import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { BillingReconciliationJobData } from '../interfaces/job-data.interface';
import { BillingService } from '../../billing/billing.service';
export declare class BillingReconciliationConsumer extends BaseConsumer<BillingReconciliationJobData> {
    private readonly billingService;
    constructor(billingService: BillingService);
    protected handleJob(job: Job<BillingReconciliationJobData>): Promise<void>;
}
