import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseConsumer } from './base.consumer';
import { AssetConversionJobData } from '../interfaces/job-data.interface';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessorService } from '../../assets/image-processor.service';
import { VideoProcessorService } from '../../assets/video-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Processor(QUEUE_NAMES.ASSET_CONVERSION)
export class AssetConversionConsumer extends BaseConsumer<AssetConversionJobData> {
  constructor(
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly videoProcessor: VideoProcessorService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  protected async handleJob(job: Job<AssetConversionJobData>): Promise<void> {
    const { assetId, sourceUrl } = job.data;
    this.logger.log(`Starting conversion for asset ${assetId}`);

    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      this.logger.error(`Asset ${assetId} not found in DB`);
      return;
    }

    const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';
    const originalKey = sourceUrl.replace(`${publicUrl}/`, '');
    
    // Download original buffer
    const originalBuffer = await this.storageService.download(originalKey);
    
    let convertedBuffer: Buffer;
    let newMimeType: string;
    let newExtension: string;
    let updateData: any = {};

    const baseOriginal = originalKey.substring(0, originalKey.lastIndexOf('.'));

    if (asset.type === 'video') {
      if (asset.mimeType === 'video/webm') {
        convertedBuffer = await this.videoProcessor.convertToMp4(originalBuffer);
        newMimeType = 'video/mp4';
        newExtension = '.mp4';
        const fallbackKey = baseOriginal.replace('-original', '-fallback') + newExtension;
        const fallbackUrl = await this.storageService.upload(fallbackKey, convertedBuffer, newMimeType);
        updateData = { fallbackUrl, convertedUrl: asset.url };
      } else {
        convertedBuffer = await this.videoProcessor.convertToWebm(originalBuffer);
        newMimeType = 'video/webm';
        newExtension = '.webm';
        const convertedKey = baseOriginal.replace('-original', '') + newExtension;
        const convertedUrl = await this.storageService.upload(convertedKey, convertedBuffer, newMimeType);
        updateData = { convertedUrl };
      }
    } else {
      if (asset.mimeType === 'image/webp') {
        convertedBuffer = await this.imageProcessor.convertToPng(originalBuffer);
        newMimeType = 'image/png';
        newExtension = '.png';
        const fallbackKey = baseOriginal.replace('-original', '-fallback') + newExtension;
        const fallbackUrl = await this.storageService.upload(fallbackKey, convertedBuffer, newMimeType);
        updateData = { fallbackUrl, convertedUrl: asset.url };
      } else {
        convertedBuffer = await this.imageProcessor.convertToWebp(originalBuffer);
        newMimeType = 'image/webp';
        newExtension = '.webp';
        const convertedKey = baseOriginal.replace('-original', '') + newExtension;
        const convertedUrl = await this.storageService.upload(convertedKey, convertedBuffer, newMimeType);
        updateData = { convertedUrl };
      }
    }
    
    // Update Database
    await this.prisma.asset.update({
      where: { id: assetId },
      data: updateData,
    });

    this.logger.log(`Completed conversion for asset ${assetId}`);
  }
}
