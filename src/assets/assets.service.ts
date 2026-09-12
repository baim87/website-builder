import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AssetConversionProducer } from '../queue/producers/asset-conversion.producer';
import { AssetPathResolverService } from './asset-path-resolver.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pathResolver: AssetPathResolverService,
    @Inject(forwardRef(() => AssetConversionProducer)) private readonly conversionProducer: AssetConversionProducer,
  ) {}

  async uploadAsset(projectId: string, userId: string, file: Express.Multer.File, purpose: string, section?: string) {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    let mimeType = file.mimetype;
    let url = '';

    const assetId = randomUUID();
    const assetType = purpose ? purpose.toUpperCase() : 'GENERAL';
    const serviceName = section ? section.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'general';
    
    const paths = this.pathResolver.resolveStoragePath(userId, projectId, assetType, serviceName, assetId);
    const extension = file.originalname?.split('.').pop() || mimeType.split('/')[1] || 'bin';
    const originalKey = `${paths.folderPath}/${paths.fileNameBase}-original.${extension}`;
    url = await this.storage.upload(originalKey, file.buffer, mimeType);

    let dbAssetType = 'document';
    if (isImage) dbAssetType = 'image';
    if (isVideo) dbAssetType = 'video';

    const asset = await this.prisma.asset.create({
      data: {
        id: assetId,
        projectId,
        url,
        type: dbAssetType,
        mimeType,
        purpose,
        source: 'upload',
        section,
      },
    });

    const isRasterImageToConvert = isImage && !['image/svg+xml', 'image/gif'].includes(mimeType);
    const isVideoToConvert = isVideo && mimeType !== 'video/webm';

    if (isRasterImageToConvert || isVideoToConvert) {
      // Async convert to WebP/PNG or WebM
      await this.conversionProducer.convertAsset(projectId, asset.id, url, userId);
    } else if (mimeType === 'video/webm') {
      // If it's already a WebM, just set convertedUrl to be the same as url
      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { convertedUrl: url },
      });
    }

    return asset;
  }

  async getAssets(projectId: string) {
    return this.prisma.asset.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAsset(projectId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, projectId } });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found or access denied`);
    }
    return asset;
  }

  async updateAsset(projectId: string, assetId: string, data: { purpose?: string; section?: string; sortOrder?: number }) {
    await this.getAsset(projectId, assetId); // verify exists
    return this.prisma.asset.update({
      where: { id: assetId },
      data,
    });
  }

  async deleteAsset(projectId: string, assetId: string) {
    const asset = await this.getAsset(projectId, assetId);

    // Best effort delete from storage
    try {
      const originalKey = asset.url.split('/').pop();
      if (originalKey) await this.storage.delete(`projects/${asset.projectId}/assets/${originalKey}`);
      
      if (asset.convertedUrl) {
        const convertedKey = asset.convertedUrl.split('/').pop();
        if (convertedKey) await this.storage.delete(`projects/${asset.projectId}/assets/${convertedKey}`);
      }
    } catch (e) {}

    await this.prisma.asset.delete({ where: { id: assetId } });
    return { success: true };
  }
}
