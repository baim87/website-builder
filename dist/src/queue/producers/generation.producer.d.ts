import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { SiteGenerationJobData } from '../interfaces/job-data.interface';
export declare class GenerationProducer extends BaseProducer<SiteGenerationJobData> {
    protected readonly queue: Queue<SiteGenerationJobData>;
    constructor(queue: Queue<SiteGenerationJobData>);
    generateSite(projectId: string): Promise<import("bullmq").Job<SiteGenerationJobData, any, string, import("bullmq").JobProgress>>;
}
