import { KeywordResult } from './interfaces/keyword-data.interface';
import { KeywordsCache } from './keywords.cache';
import { GoogleAdsClient } from './clients/google-ads.client';
export declare class KeywordsService {
    private readonly cache;
    private readonly googleAdsClient;
    constructor(cache: KeywordsCache, googleAdsClient: GoogleAdsClient);
    getKeywords(trade: string, location: string): Promise<KeywordResult[]>;
}
