import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { SiteGenerationJobData } from '../interfaces/job-data.interface';
import { GenerationService } from '../../generation/generation.service';
export declare class GenerationConsumer extends BaseConsumer<SiteGenerationJobData> {
    private readonly generationService;
    constructor(generationService: GenerationService);
    protected handleJob(job: Job<SiteGenerationJobData>): Promise<void>;
}
