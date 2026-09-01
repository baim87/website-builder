import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
export declare abstract class BaseConsumer<T> extends WorkerHost {
    protected readonly logger: Logger;
    process(job: Job<T, any, string>): Promise<any>;
    protected abstract handleJob(job: Job<T, any, string>): Promise<any>;
}
