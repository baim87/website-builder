import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { AssetConversionJobData } from '../interfaces/job-data.interface';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessorService } from '../../assets/image-processor.service';
import { VideoProcessorService } from '../../assets/video-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class AssetConversionConsumer extends BaseConsumer<AssetConversionJobData> {
    private readonly storageService;
    private readonly imageProcessor;
    private readonly videoProcessor;
    private readonly prisma;
    private readonly configService;
    constructor(storageService: StorageService, imageProcessor: ImageProcessorService, videoProcessor: VideoProcessorService, prisma: PrismaService, configService: ConfigService);
    protected handleJob(job: Job<AssetConversionJobData>): Promise<void>;
}
