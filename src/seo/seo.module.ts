import { Module } from '@nestjs/common';
import { SeoArtifactsService } from './seo-artifacts.service';
import { LocationMetricsService } from './location-metrics.service';
import { KeywordsModule } from '../keywords/keywords.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [KeywordsModule, PrismaModule, ConfigModule],
  providers: [SeoArtifactsService, LocationMetricsService],
  exports: [SeoArtifactsService, LocationMetricsService],
})
export class SeoModule {}
