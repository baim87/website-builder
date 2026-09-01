import { Module } from '@nestjs/common';
import { SeoArtifactsService } from './seo-artifacts.service';

@Module({
  providers: [SeoArtifactsService],
  exports: [SeoArtifactsService],
})
export class SeoModule {}
