import { Module } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { KeywordsCache } from './keywords.cache';
import { GoogleAdsClient } from './clients/google-ads.client';

import { ServiceRankingService } from './service-ranking.service';
import { SeasonalityService } from './seasonality.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AIGatewayModule, PrismaModule],
  providers: [
    KeywordsService,
    KeywordsCache,
    GoogleAdsClient,
    ServiceRankingService,
    SeasonalityService,
  ],
  exports: [KeywordsService, GoogleAdsClient, ServiceRankingService, SeasonalityService],
})
export class KeywordsModule {}
