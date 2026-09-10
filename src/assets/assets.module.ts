import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { ImageProcessorService } from './image-processor.service';
import { VideoProcessorService } from './video-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PublicProjectAssetsController } from './public-project-assets.controller';
import { QueueModule } from '../queue/queue.module';
import { LogoGenerationService } from './logo-generation.service';
import { PortraitGenerationService } from './portrait-generation.service';

import { BrandExtractionService } from './brand-extraction.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ImagesModule } from '../images/images.module';
import { AssetPathResolverService } from './asset-path-resolver.service';
import { PartnerBrandService } from './partner-brand.service';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, forwardRef(() => QueueModule), AIGatewayModule, ImagesModule],
  controllers: [AssetsController, PublicProjectAssetsController],
  providers: [AssetsService, ImageProcessorService, VideoProcessorService, LogoGenerationService, PortraitGenerationService, BrandExtractionService, AssetPathResolverService, PartnerBrandService],
  exports: [AssetsService, ImageProcessorService, VideoProcessorService, LogoGenerationService, PortraitGenerationService, BrandExtractionService, AssetPathResolverService, PartnerBrandService],
})
export class AssetsModule {}
