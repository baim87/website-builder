import { Queue } from 'bullmq';
import { BaseProducer } from './base.producer';
import { AssetConversionJobData } from '../interfaces/job-data.interface';
export declare class AssetConversionProducer extends BaseProducer<AssetConversionJobData> {
    protected readonly queue: Queue<AssetConversionJobData>;
    constructor(queue: Queue<AssetConversionJobData>);
    convertAsset(projectId: string, assetId: string, sourceUrl: string): Promise<import("bullmq").Job<AssetConversionJobData, any, string, import("bullmq").JobProgress>>;
}
