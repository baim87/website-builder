import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

export abstract class BaseProducer<T> {
  protected abstract readonly queue: Queue<T>;
  protected readonly logger = new Logger(this.constructor.name);

  async addJob(jobName: string, data: T, opts?: any) {
    this.logger.log(`Enqueuing job [${jobName}] to queue ${this.queue.name}`);
    return this.queue.add(jobName as any, data as any, opts);
  }
}
