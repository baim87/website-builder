import { Injectable, Logger } from '@nestjs/common';
import ffmpeg = require('fluent-ffmpeg');
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Set the ffmpeg path so it works everywhere without global installs
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);

  async convertToWebm(buffer: Buffer): Promise<Buffer> {
    const tempId = uuidv4();
    const inputPath = path.join(os.tmpdir(), `${tempId}-input.tmp`);
    const outputPath = path.join(os.tmpdir(), `${tempId}-output.webm`);

    try {
      // Write buffer to temporary file because ffmpeg prefers files
      await fs.writeFile(inputPath, buffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .output(outputPath)
          .videoCodec('libvpx-vp9')
          .audioCodec('libopus') // webm standard audio
          .outputOptions([
            '-crf 30',          // Constant Rate Factor (balance quality/size)
            '-b:v 0',           // Required for CRF in VP9
            '-deadline realtime', // Speeds up conversion at slight size cost
            '-cpu-used 4'       // Balances speed and quality
          ])
          .on('end', () => {
            this.logger.log(`Successfully converted video to WebM: ${outputPath}`);
            resolve();
          })
          .on('error', (err: any) => {
            this.logger.error(`Error converting video to WebM`, err);
            reject(err);
          })
          .run();
      });

      // Read the output WebM file back into a Buffer
      const webmBuffer = await fs.readFile(outputPath);
      return webmBuffer;
    } catch (e: any) {
      this.logger.error('Failed to process video', e.stack);
      throw e;
    } finally {
      // Cleanup temporary files
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  }
}
