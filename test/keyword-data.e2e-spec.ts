import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { KeywordsService } from '../src/keywords/keywords.service';
import { GoogleAdsClient } from '../src/keywords/clients/google-ads.client';

describe('KeywordsService (e2e)', () => {
  let app: INestApplication;
  let keywordsService: KeywordsService;
  let googleAdsClient: GoogleAdsClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    keywordsService = app.get<KeywordsService>(KeywordsService);
    googleAdsClient = app.get<GoogleAdsClient>(GoogleAdsClient);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch keywords from Google Ads and cache the result', async () => {
    const mockKeywords = [
      { keyword: 'roofer', searchVolume: 1000, competition: 0.5 },
      { keyword: 'roof repair', searchVolume: 500, competition: 0.3 },
    ];

    const fetchSpy = jest.spyOn(googleAdsClient, 'fetchKeywords').mockResolvedValue(mockKeywords as any);

    const trade = 'roofer' + Date.now();
    const location = 'Seattle';

    // First call should hit Google Ads
    const result1 = await keywordsService.getKeywords(trade, location);
    expect(result1).toEqual(mockKeywords);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should hit the cache
    const result2 = await keywordsService.getKeywords(trade, location);
    expect(result2).toEqual(mockKeywords);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1!
  });
});
