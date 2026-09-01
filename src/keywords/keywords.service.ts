import { Injectable } from '@nestjs/common';
import { KeywordResult } from './interfaces/keyword-data.interface';
import { KeywordsCache } from './keywords.cache';
import { GoogleAdsClient } from './clients/google-ads.client';

@Injectable()
export class KeywordsService {
  constructor(
    private readonly cache: KeywordsCache,
    private readonly googleAdsClient: GoogleAdsClient,
  ) {}

  async getKeywords(trade: string, location: string): Promise<KeywordResult[]> {
    const cached = await this.cache.get(trade, location);
    if (cached) {
      return cached;
    }

    const results = await this.googleAdsClient.fetchKeywords(trade, location);

    await this.cache.set(trade, location, results);
    return results;
  }
}
