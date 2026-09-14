import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetPathResolverService } from './asset-path-resolver.service';
import { ASSET_PURPOSE, AssetPurpose } from './constants/asset-purpose.constant';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class BrandAssetIngestionService {
  private readonly logger = new Logger(BrandAssetIngestionService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly pathResolver: AssetPathResolverService,
  ) {}

  /**
   * Processes a logo or favicon, uploads it to R2, and saves it in the database.
   * Input can be a URL, local file path, or a raw Buffer (from a multipart upload).
   */
  async processAsset(
    projectId: string,
    userId: string,
    purpose: AssetPurpose,
    input: string | Buffer,
    providedMimeType?: string
  ): Promise<{ url: string; buffer: Buffer }> {
    let buffer: Buffer;
    let mimeType = providedMimeType || 'image/png';
    let extension = 'png';

    // 1. Resolve Input to Buffer
    if (Buffer.isBuffer(input)) {
      buffer = input;
      if (mimeType.includes('svg')) extension = 'svg';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
      else if (mimeType.includes('webp')) extension = 'webp';
    } else if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        this.logger.log(`Fetching ${purpose} from URL: ${input}`);
        const res = await axios.get(input, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        buffer = Buffer.from(res.data);
        mimeType = (res.headers['content-type'] as string) || mimeType;
      } else {
        this.logger.log(`Reading ${purpose} from local path: ${input}`);
        buffer = fs.readFileSync(input);
        const ext = path.extname(input).toLowerCase();
        if (ext === '.svg') { mimeType = 'image/svg+xml'; extension = 'svg'; }
        else if (ext === '.jpg' || ext === '.jpeg') { mimeType = 'image/jpeg'; extension = 'jpg'; }
        else if (ext === '.webp') { mimeType = 'image/webp'; extension = 'webp'; }
      }
    } else {
      throw new Error(`Invalid input type for ${purpose}`);
    }

    // Attempt to verify image format via sharp (optional safety check)
    try {
      const metadata = await sharp(buffer).metadata();
      if (metadata.format === 'svg') extension = 'svg';
      else if (metadata.format) extension = metadata.format;
    } catch (e) {
      this.logger.warn(`Could not extract metadata from ${purpose}, continuing with extension .${extension}`);
    }

    // 2. Resolve R2 Path
    const projectAssetId = uuidv4();
    const { key } = this.pathResolver.resolveBrandAssetPath(userId, projectId, purpose, extension, projectAssetId);

    // 3. Upload to R2
    this.logger.log(`Uploading ${purpose} to R2 key: ${key}`);
    const uploadedUrl = await this.storageService.upload(key, buffer, mimeType);

    // 4. Save to Database
    await this.prisma.asset.create({
      data: {
        projectId,
        url: uploadedUrl,
        type: 'image',
        purpose,
        section: purpose === 'logo' ? 'header,footer' : 'head',
      },
    });

    this.logger.log(`Successfully ingested ${purpose}: ${uploadedUrl}`);
    return { url: uploadedUrl, buffer };
  }

  /**
   * Generates a 32x32 favicon from an existing logo buffer, as a fallback when the user has no favicon.
   */
  async deriveFaviconFromLogo(projectId: string, userId: string, logoBuffer: Buffer): Promise<string> {
    this.logger.log(`Deriving fallback favicon from logo for project ${projectId}`);
    
    let faviconBuffer: Buffer;
    try {
      faviconBuffer = await sharp(logoBuffer)
        .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    } catch (e: any) {
      this.logger.error(`Failed to derive favicon from logo: ${e.message}`);
      throw new Error('Failed to generate favicon from logo buffer');
    }

    const projectAssetId = uuidv4();
    const { key } = this.pathResolver.resolveBrandAssetPath(userId, projectId, 'favicon', 'png', projectAssetId);
    
    const uploadedUrl = await this.storageService.upload(key, faviconBuffer, 'image/png');

    await this.prisma.asset.create({
      data: {
        projectId,
        url: uploadedUrl,
        type: 'image',
        purpose: ASSET_PURPOSE.FAVICON,
        section: 'head',
      },
    });

    this.logger.log(`Successfully derived favicon: ${uploadedUrl}`);
    return uploadedUrl;
  }
}
