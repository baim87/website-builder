import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { SiteGenerationJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { GenerationService } from '../../generation/generation.service';

@Processor(QUEUE_NAMES.SITE_GENERATION)
export class GenerationConsumer extends BaseConsumer<SiteGenerationJobData> {
  constructor(private readonly generationService: GenerationService) {
    super();
  }

  protected async handleJob(job: Job<SiteGenerationJobData>): Promise<void> {
    this.logger.log(`Site generation would happen here for project ${job.data.projectId}`);
    await this.generationService.generateProject(job.data.projectId);
  }
}
