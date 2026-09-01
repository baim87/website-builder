import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { TestJobData } from '../interfaces/job-data.interface';
export declare class TestJobConsumer extends BaseConsumer<TestJobData> {
    protected handleJob(job: Job<TestJobData>): Promise<void>;
}
