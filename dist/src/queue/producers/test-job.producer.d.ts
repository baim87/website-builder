import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { TestJobData } from '../interfaces/job-data.interface';
export declare class TestJobProducer extends BaseProducer<TestJobData> {
    protected readonly queue: Queue<TestJobData>;
    constructor(queue: Queue<TestJobData>);
    queueTestJob(message: string, fail?: boolean): Promise<import("bullmq").Job<TestJobData, any, string, import("bullmq").JobProgress>>;
}
