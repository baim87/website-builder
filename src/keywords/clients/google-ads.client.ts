import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordResult } from '../interfaces/keyword-data.interface';
import { GoogleAdsApi } from 'google-ads-api';

@Injectable()
export class GoogleAdsClient {
  private readonly logger = new Logger(GoogleAdsClient.name);
  private client: GoogleAdsApi | null = null;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_ADS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_ADS_CLIENT_SECRET');
    const developerToken = this.configService.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN');

    if (clientId && clientSecret && developerToken) {
      this.client = new GoogleAdsApi({
        client_id: clientId,
        client_secret: clientSecret,
        developer_token: developerToken,
      });
    } else {
      this.logger.warn('Google Ads credentials not found in environment. Keyword generation will fail if invoked.');
    }
  }

  async fetchKeywords(trade: string, location: string): Promise<KeywordResult[]> {
    this.logger.log(`Fetching keywords from Google Ads for ${trade} in ${location}`);
    
    if (!this.client) {
      throw new Error('Google Ads API client is not initialized due to missing credentials.');
    }

    const customerId = this.configService.get<string>('GOOGLE_ADS_CUSTOMER_ID');
    const refreshToken = this.configService.get<string>('GOOGLE_ADS_REFRESH_TOKEN');

    if (!customerId || !refreshToken) {
      throw new Error('Google Ads CUSTOMER_ID or REFRESH_TOKEN is missing from environment.');
    }

    const customer = this.client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });

    try {
      const request: any = {
        customer_id: customerId,
        keyword_seed: {
          keywords: [`${trade} ${location}`, `${location} ${trade}`, trade],
        },
        page_size: 15,
      };

      const response: any = await customer.keywordPlanIdeas.generateKeywordIdeas(request);

      const results = response.results || [];
      return results.map((idea: any) => ({
        keyword: idea.text || '',
        searchVolume: idea.keyword_idea_metrics?.avg_monthly_searches ? Number(idea.keyword_idea_metrics.avg_monthly_searches) : 0,
        source: 'google',
      }));
    } catch (error: any) {
      this.logger.error('Failed to generate keyword ideas', error.stack);
      throw error;
    }
  }
}
