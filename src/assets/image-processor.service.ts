import { Injectable, Logger } from '@nestjs/common';
import sharp = require('sharp');

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  async convertToWebp(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch (e: any) {
      this.logger.error('Failed to convert image to WebP', e.stack);
      throw e;
    }
  }

  async extractMetadata(buffer: Buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      };
    } catch (e: any) {
      this.logger.error('Failed to extract image metadata', e.stack);
      return null;
    }
  }
}
