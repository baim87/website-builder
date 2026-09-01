import { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { BillingReconciliationJobData } from '../interfaces/job-data.interface';
export declare class BillingReconciliationProducer extends BaseProducer<BillingReconciliationJobData> implements OnModuleInit {
    protected readonly queue: Queue<BillingReconciliationJobData>;
    constructor(queue: Queue<BillingReconciliationJobData>);
    onModuleInit(): Promise<void>;
    reconcileBilling(userId: string, subscriptionId: string): Promise<import("bullmq").Job<BillingReconciliationJobData, any, string, import("bullmq").JobProgress>>;
}
