import { Module, forwardRef } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { ImageProcessorService } from './image-processor.service';
import { VideoProcessorService } from './video-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, StorageModule, forwardRef(() => QueueModule)],
  controllers: [AssetsController],
  providers: [AssetsService, ImageProcessorService, VideoProcessorService],
  exports: [AssetsService, ImageProcessorService, VideoProcessorService],
})
export class AssetsModule {}
