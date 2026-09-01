import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { TestJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class TestJobProducer extends BaseProducer<TestJobData> {
  constructor(
    @InjectQueue(QUEUE_NAMES.TEST_JOB) protected readonly queue: Queue<TestJobData>,
  ) {
    super();
  }

  async queueTestJob(message: string, fail: boolean = false) {
    return this.addJob('test', { message, fail }, { attempts: 3 });
  }
}
