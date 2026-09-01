import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { AnalyticsProvisioningJobData } from '../interfaces/job-data.interface';
import { AnalyticsService } from '../../analytics/analytics.service';
export declare class AnalyticsProvisioningConsumer extends BaseConsumer<AnalyticsProvisioningJobData> {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    protected handleJob(job: Job<AnalyticsProvisioningJobData>): Promise<void>;
}
