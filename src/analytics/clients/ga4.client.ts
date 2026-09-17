import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleAuthClient } from './google-auth.client';

@Injectable()
export class Ga4Client {
  private readonly logger = new Logger(Ga4Client.name);
  private gaAdminClient: AnalyticsAdminServiceClient;
  private gaDataClient: BetaAnalyticsDataClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly authClient: GoogleAuthClient,
  ) {
    try {
      const credentials = {
        client_email: this.authClient.clientEmail,
        private_key: this.authClient.privateKey?.replace(/\\n/g, '\n'),
      };
      
      this.gaAdminClient = new AnalyticsAdminServiceClient({ credentials });
      this.gaDataClient = new BetaAnalyticsDataClient({ credentials });
    } catch (e) {
      this.logger.warn('GA4 Clients not initialized (missing auth credentials)');
    }
  }

  async createPropertyAndStream(domainName: string, businessName: string) {
    const accountId = this.configService.get<string>('GOOGLE_ANALYTICS_ACCOUNT_ID');
    if (!accountId) throw new Error('Missing GA4 Account ID in env');

    if (!this.gaAdminClient) throw new Error('GA4 Admin client not initialized');

    this.logger.log(`Creating GA4 Property for ${domainName} (${businessName})`);

    // 1. Create Property
    const [property] = await this.gaAdminClient.createProperty({
      property: {
        parent: `accounts/${accountId}`,
        displayName: `LE - ${businessName}`,
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

  async grantAdminAccess(propertyId: string, emailAddress: string) {
    if (!this.gaAdminClient) throw new Error('GA4 Admin client not initialized');

    this.logger.log(`Granting GA4 Admin access to ${emailAddress} for Property ${propertyId}`);

    await this.gaAdminClient.createAccessBinding({
      parent: `properties/${propertyId}`,
      accessBinding: {
        user: emailAddress,
        roles: ['predefinedRoles/admin'],
      },
    });
  }

  async updateDataStreamUrl(propertyId: string, newDomainName: string) {
    if (!this.gaAdminClient) throw new Error('GA4 Admin client not initialized');

    this.logger.log(`Updating GA4 Web Data Stream for Property ${propertyId} to ${newDomainName}`);

    // List data streams
    const [dataStreams] = await this.gaAdminClient.listDataStreams({
      parent: `properties/${propertyId}`,
    });

    // Find the first WEB data stream
    const webStream = dataStreams.find(s => s.type === 'WEB_DATA_STREAM');
    
    if (webStream && webStream.name) {
      await this.gaAdminClient.updateDataStream({
        dataStream: {
          name: webStream.name,
          displayName: `${newDomainName} Web Stream`,
          webStreamData: {
            defaultUri: `https://${newDomainName}`,
          },
        },
        updateMask: { paths: ['display_name', 'web_stream_data.default_uri'] },
      });
    } else {
      this.logger.warn(`No Web Data Stream found for Property ${propertyId}`);
    }
  }

  async markEventsAsConversions(propertyId: string, eventNames: string[]) {
    if (!this.gaAdminClient) throw new Error('GA4 Admin client not initialized');

    this.logger.log(`Marking ${eventNames.length} events as conversions for Property ${propertyId}`);

    for (const eventName of eventNames) {
      try {
        await this.gaAdminClient.createConversionEvent({
          parent: `properties/${propertyId}`,
          conversionEvent: {
            eventName,
          },
        });
        this.logger.log(`Successfully marked '${eventName}' as a conversion for Property ${propertyId}`);
      } catch (error: any) {
        // If it already exists, GA4 returns ALREADY_EXISTS error, which we can safely ignore
        if (error.code === 6 || error.message?.includes('already exists')) {
          this.logger.log(`Event '${eventName}' is already marked as a conversion.`);
        } else {
          this.logger.error(`Failed to mark '${eventName}' as conversion: ${error.message}`);
          throw error;
        }
      }
    }
  }

  async getAnalyticsReport(propertyId: string, period: string = '30d') {
    if (!this.gaDataClient) throw new Error('GA4 Data client not initialized');

    // Parse the period into days
    let daysAgo = '30daysAgo';
    if (period === '7d') daysAgo = '7daysAgo';
    else if (period === '30d') daysAgo = '30daysAgo';
    else if (period === '90d') daysAgo = '90daysAgo';
    else if (period === '12m') daysAgo = '365daysAgo';

    this.logger.log(`Fetching GA4 Analytics Report for property ${propertyId} with period ${period} (${daysAgo})`);

    try {
      const [overviewResponse] = await this.gaDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: daysAgo, endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'sessionConversionRate' },
          { name: 'averageSessionDuration' }
        ],
        dimensions: [
          { name: 'date' },
          { name: 'sessionDefaultChannelGroup' },
          { name: 'deviceCategory' },
          { name: 'region' }
        ],
        metricAggregations: [1]
      });

      const [conversionsResponse] = await this.gaDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: daysAgo, endDate: 'today' }],
        metrics: [
          { name: 'conversions' }
        ],
        dimensions: [
          { name: 'eventName' }
        ],
      });

      return { overview: overviewResponse, conversions: conversionsResponse };
    } catch (e: any) {
      this.logger.error(`Failed to fetch GA4 report: ${e.message}`);
      return null;
    }
  }

  async getRealtimeRegionReport(propertyId: string) {
    if (!this.gaDataClient) throw new Error('GA4 Data client not initialized');

    this.logger.log(`Fetching GA4 Realtime Report for property ${propertyId}`);

    try {
      const [response] = await this.gaDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [
          { name: 'activeUsers' }
        ],
        dimensions: [
          { name: 'region' }
        ],
      });

      return response;
    } catch (e: any) {
      this.logger.error(`Failed to fetch GA4 realtime report: ${e.message}`);
      return null;
    }
  }

  async getRealtimeConversionsReport(propertyId: string) {
    if (!this.gaDataClient) throw new Error('GA4 Data client not initialized');

    try {
      const [response] = await this.gaDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: 'conversions' }],
        dimensions: [{ name: 'eventName' }],
      });
      return response;
    } catch (e: any) {
      this.logger.error(`Failed to fetch GA4 realtime conversions: ${e.message}`);
      return null;
    }
  }

  async getRealtimeReport(propertyId: string) {
    if (!this.gaDataClient) throw new Error('GA4 Data client not initialized');

    this.logger.log(`Fetching GA4 full Realtime Report for property ${propertyId}`);

    try {
      const [response] = await this.gaDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [
          { name: 'activeUsers' }
        ],
        dimensions: [
          { name: 'minutesAgo' },
          { name: 'firstUserSource' },
          { name: 'audienceName' },
          { name: 'unifiedScreenName' }, // usually works as page title
          { name: 'region' }
        ],
      });

      return response;
    } catch (e: any) {
      this.logger.error(`Failed to fetch GA4 full realtime report: ${e.message}`);
      return null;
    }
  }
}
