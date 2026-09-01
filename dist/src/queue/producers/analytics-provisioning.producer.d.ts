import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { AnalyticsProvisioningJobData } from '../interfaces/job-data.interface';
export declare class AnalyticsProvisioningProducer extends BaseProducer<AnalyticsProvisioningJobData> {
    protected readonly queue: Queue<AnalyticsProvisioningJobData>;
    constructor(queue: Queue<AnalyticsProvisioningJobData>);
    provisionAnalytics(projectId: string, domain: string): Promise<import("bullmq").Job<AnalyticsProvisioningJobData, any, string, import("bullmq").JobProgress>>;
}
