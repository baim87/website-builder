import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { SiteGenerationJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class GenerationProducer extends BaseProducer<SiteGenerationJobData> {
  constructor(
    @InjectQueue(QUEUE_NAMES.SITE_GENERATION) protected readonly queue: Queue<SiteGenerationJobData>,
  ) {
    super();
  }

  async generateSite(projectId: string, userId: string) {
    const jobId = `generate-${projectId}-${Date.now()}`;
    return this.addJob('generate', { projectId, userId, generateFullSite: true }, { attempts: 3, jobId });
  }
}
