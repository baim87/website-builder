import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

export abstract class BaseConsumer<T> extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  async process(job: Job<T, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    try {
      const result = await this.handleJob(job);
      this.logger.log(`Completed job ${job.id}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed job ${job.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  protected abstract handleJob(job: Job<T, any, string>): Promise<any>;
}
