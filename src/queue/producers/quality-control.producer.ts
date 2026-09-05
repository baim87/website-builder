import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class QualityControlProducer {
  private readonly logger = new Logger(QualityControlProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.QUALITY_CONTROL) private readonly qcQueue: Queue,
  ) {}

  async triggerQualityControl(projectId: string, vercelUrl: string, businessType: string, retryCount: number = 0) {
    this.logger.log(`Dispatching QC job for project ${projectId} at ${vercelUrl} (Attempt ${retryCount + 1})`);
    
    await this.qcQueue.add('run-qc', {
      projectId,
      vercelUrl,
      businessType,
      retryCount,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
