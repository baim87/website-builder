import { Module } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { KeywordsCache } from './keywords.cache';
import { GoogleAdsClient } from './clients/google-ads.client';

@Module({
  providers: [
    KeywordsService,
    KeywordsCache,
    GoogleAdsClient,
  ],
  exports: [KeywordsService],
})
export class KeywordsModule {}
