import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { AssetConversionJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';

@Injectable()
export class AssetConversionProducer extends BaseProducer<AssetConversionJobData> {
  constructor(
    @InjectQueue(QUEUE_NAMES.ASSET_CONVERSION) protected readonly queue: Queue<AssetConversionJobData>,
  ) {
    super();
  }

  async convertAsset(projectId: string, assetId: string, sourceUrl: string) {
    return this.addJob('convert', { projectId, assetId, sourceUrl }, { attempts: 2 });
  }
}
