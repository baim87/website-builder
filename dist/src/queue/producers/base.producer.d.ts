import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
export declare abstract class BaseProducer<T> {
    protected abstract readonly queue: Queue<T>;
    protected readonly logger: Logger;
    addJob(jobName: string, data: T, opts?: any): Promise<import("bullmq").Job<T extends import("bullmq").Job<infer D, any, any, import("bullmq").JobProgress> ? D : T, T extends import("bullmq").Job<any, infer R, any, import("bullmq").JobProgress> ? R : any, T extends import("bullmq").Job<any, any, infer N extends string, import("bullmq").JobProgress> ? N : string, import("bullmq").JobProgress>>;
}
