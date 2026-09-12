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

import { AssetPathResolverService } from './asset-path-resolver.service';
import { PartnerBrandService } from './partner-brand.service';
import { BrandAssetIngestionService } from './brand-asset-ingestion.service';
import { BrandExportService } from './brand-export.service';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, forwardRef(() => QueueModule), AIGatewayModule, forwardRef(() => SkillsModule)],
  controllers: [AssetsController, PublicProjectAssetsController],
  providers: [AssetsService, ImageProcessorService, VideoProcessorService, LogoGenerationService, PortraitGenerationService, BrandExtractionService, AssetPathResolverService, PartnerBrandService, BrandAssetIngestionService, BrandExportService],
  exports: [AssetsService, ImageProcessorService, VideoProcessorService, LogoGenerationService, PortraitGenerationService, BrandExtractionService, AssetPathResolverService, PartnerBrandService, BrandAssetIngestionService, BrandExportService],
})
export class AssetsModule {}
