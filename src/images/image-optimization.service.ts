import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  async optimizeToWebp(imageBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.log('Optimizing image to WebP format...');
      const webpBuffer = await sharp(imageBuffer)
        .webp({ quality: 80, effort: 6 }) // quality 80, high compression effort
        .toBuffer();
      
      this.logger.log(`Optimization complete. Original size: ${imageBuffer.length} bytes, Optimized size: ${webpBuffer.length} bytes`);
      return webpBuffer;
    } catch (error) {
      this.logger.error('Failed to optimize image', error);
      throw error;
    }
  }
}
