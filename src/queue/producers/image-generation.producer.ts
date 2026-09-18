import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { ImageGenerationJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class ImageGenerationProducer extends BaseProducer<ImageGenerationJobData> {
  constructor(
    @InjectQueue(QUEUE_NAMES.IMAGE_GENERATION) protected readonly queue: Queue<ImageGenerationJobData>,
  ) {
    super();
  }

  async generateImage(projectId: string, userId: string, projectAssetId: string) {
    this.logger.log(`Queueing image generation for projectAssetId: ${projectAssetId}`);
    return this.addJob('generate', { projectId, userId, projectAssetId }, { attempts: 2, backoff: { type: 'exponential', delay: 10000 } });
  }
}
