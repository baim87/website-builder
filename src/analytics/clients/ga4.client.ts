import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { GoogleAuthClient } from './google-auth.client';

@Injectable()
export class Ga4Client {
  private readonly logger = new Logger(Ga4Client.name);
  private gaAdminClient: AnalyticsAdminServiceClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly authClient: GoogleAuthClient,
  ) {
    try {
      this.gaAdminClient = new AnalyticsAdminServiceClient({
        credentials: {
          client_email: this.authClient.clientEmail,
          private_key: this.authClient.privateKey?.replace(/\\n/g, '\n'),
        },
      });
    } catch (e) {
      this.logger.warn('GA4 Admin Client not initialized (missing auth credentials)');
    }
  }

  async createPropertyAndStream(domainName: string) {
    const accountId = this.configService.get<string>('GOOGLE_ANALYTICS_ACCOUNT_ID');
    if (!accountId) throw new Error('Missing GA4 Account ID in env');

    if (!this.gaAdminClient) throw new Error('GA4 Admin client not initialized');

    this.logger.log(`Creating GA4 Property for ${domainName}`);

    // 1. Create Property
    const [property] = await this.gaAdminClient.createProperty({
      property: {
        parent: `accounts/${accountId}`,
        displayName: `Local Empire - ${domainName}`,
        timeZone: 'America/New_York',
        currencyCode: 'USD',
      },
    });

    // 2. Create Web Data Stream
    const [dataStream] = await this.gaAdminClient.createDataStream({
      parent: property.name,
      dataStream: {
        type: 'WEB_DATA_STREAM',
        displayName: `${domainName} Web Stream`,
        webStreamData: {
          defaultUri: `https://${domainName}`,
        },
      },
    });

    const propertyId = property.name?.split('/')[1] || '';
    const measurementId = dataStream.webStreamData?.measurementId || '';

    return { propertyId, measurementId };
  }
}
