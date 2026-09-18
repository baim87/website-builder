import { Module } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { KeywordsCache } from './keywords.cache';
import { GoogleAdsClient } from './clients/google-ads.client';

import { ServiceRankingService } from './service-ranking.service';
import { SeasonalityService } from './seasonality.service';
import { ServiceSuggestionService } from './service-suggestion.service';
import { SecondaryKeywordWorker } from './secondary-keyword.worker';
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
    ServiceSuggestionService,
    SecondaryKeywordWorker,
  ],
  exports: [KeywordsService, GoogleAdsClient, ServiceRankingService, SeasonalityService, ServiceSuggestionService, SecondaryKeywordWorker],
})
export class KeywordsModule {}
