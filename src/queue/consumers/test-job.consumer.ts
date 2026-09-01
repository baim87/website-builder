import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { TestJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Processor(QUEUE_NAMES.TEST_JOB)
export class TestJobConsumer extends BaseConsumer<TestJobData> {
  protected async handleJob(job: Job<TestJobData>): Promise<void> {
    this.logger.log(`Processing test job with message: ${job.data.message}`);
    
    if (job.data.fail) {
      throw new Error('Test job configured to fail');
    }
  }
}
