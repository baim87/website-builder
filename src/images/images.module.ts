import { Module } from '@nestjs/common';
import { ImageOptimizationService } from './image-optimization.service';
import { UnsplashService } from './unsplash.service';
import { ImageCritiqueService } from './image-critique.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AIGatewayModule],
  providers: [ImageOptimizationService, UnsplashService, ImageCritiqueService],
  exports: [ImageOptimizationService, UnsplashService, ImageCritiqueService]
})
export class ImagesModule {}
