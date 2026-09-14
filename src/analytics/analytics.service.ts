import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Ga4Client } from './clients/ga4.client';
import { GtmClient } from './clients/gtm.client';
import { GscClient } from './clients/gsc.client';
import { getErrorMessage } from '../common/utils/error.util';
import { ANALYTICS_STATUS } from './constants/analytics-status.constant';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ga4Client: Ga4Client,
    private readonly gtmClient: GtmClient,
    private readonly gscClient: GscClient,
  ) {}

  async provisionAnalytics(projectId: string, domainName: string) {
    this.logger.log(`Processing analytics provision job for project ${projectId} on domain ${domainName}`);

    // Check if already fully provisioned
    const existing = await this.prisma.siteAnalytics.findUnique({ where: { projectId } });
    if (existing && existing.gscVerificationStatus === 'VERIFIED') {
      this.logger.log(`Analytics already fully provisioned for ${projectId}`);
      return existing;
    }

    try {
      let propertyId = existing?.ga4PropertyId;
      let measurementId = existing?.ga4MeasurementId;
      let gtmContainerId = existing?.gtmContainerId;

      let gtmInternalId: string | undefined;

      // Only create if they don't exist yet (idempotency)
      if (!propertyId || !measurementId) {
        const ga4 = await this.ga4Client.createPropertyAndStream(domainName);
        propertyId = ga4.propertyId;
        measurementId = ga4.measurementId;
      }

      if (!gtmContainerId) {
        const gtm = await this.gtmClient.createContainer(domainName);
        gtmContainerId = gtm.publicId || undefined;
        gtmInternalId = gtm.containerId || undefined;
      }

      // Configure newly created containers
      if (gtmInternalId && measurementId && propertyId) {
        await this.gtmClient.configureContainer(gtmInternalId, measurementId);
        
        // The user specifically requested to test with this email
        const adminEmail = 'baim@contractingempire.com';
        await this.ga4Client.grantAdminAccess(propertyId, adminEmail);
        await this.gtmClient.grantAdminAccess(gtmInternalId, adminEmail);
      }
      
      // Attempt GSC Verification
      let gscStatus = 'PENDING';
      try {
        await this.gscClient.verifySite(domainName);
        gscStatus = 'VERIFIED';
      } catch (e) {
        this.logger.warn(`GSC Provisioning delayed for ${domainName} (DNS likely not propagated). Will retry via BullMQ. Error: ${getErrorMessage(e)}`);
        // Throwing error causes BullMQ to retry the job according to the backoff strategy
        throw new Error(`GSC Verification failed: ${getErrorMessage(e)}`);
      }

      // Persist to database (upsert to handle retries cleanly)
      const analyticsRecord = await this.prisma.siteAnalytics.upsert({
        where: { projectId },
        create: {
          projectId,
          ga4PropertyId: propertyId!,
          ga4MeasurementId: measurementId!,
          gtmContainerId: gtmContainerId!,
          gscSiteUrl: `https://${domainName}`,
          gscVerificationStatus: gscStatus,
        },
        update: {
          ga4PropertyId: propertyId!,
          ga4MeasurementId: measurementId!,
          gtmContainerId: gtmContainerId!,
          gscSiteUrl: `https://${domainName}`,
          gscVerificationStatus: gscStatus,
        }
      });

      this.logger.log(`Successfully provisioned all analytics for ${projectId}`);
      return analyticsRecord;
    } catch (error) {
      this.logger.error(`Analytics provisioning job failed: ${getErrorMessage(error)}`);
      throw error; // Rethrow so BullMQ knows it failed and will retry
    }
  }

  async getAnalyticsSummary(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });

    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const analytics = await this.prisma.siteAnalytics.findUnique({
      where: { projectId },
    });

    if (!analytics) {
      return { status: ANALYTICS_STATUS.NOT_PROVISIONED };
    }

    return {
      status: ANALYTICS_STATUS.ACTIVE,
      gtmContainerId: analytics.gtmContainerId,
      ga4MeasurementId: analytics.ga4MeasurementId,
      gscStatus: analytics.gscVerificationStatus,
      overview: {
        totalVisitors: 12450,
        visitorsTrend: 12.5,
        bounceRate: 42.3,
        bounceRateTrend: -2.1,
        conversionRate: 3.8,
        conversionRateTrend: 0.5,
        avgSessionDuration: '2m 15s',
      },
      trafficOverTime: [
        { name: 'Mon', visitors: 400, pageViews: 600 },
        { name: 'Tue', visitors: 300, pageViews: 450 },
        { name: 'Wed', visitors: 550, pageViews: 800 },
        { name: 'Thu', visitors: 450, pageViews: 700 },
        { name: 'Fri', visitors: 600, pageViews: 950 },
        { name: 'Sat', visitors: 800, pageViews: 1200 },
        { name: 'Sun', visitors: 750, pageViews: 1100 },
      ],
      trafficSources: [
        { name: 'Organic Search', value: 45 },
        { name: 'Direct', value: 25 },
        { name: 'Social', value: 20 },
        { name: 'Referral', value: 10 },
      ],
      devices: [
        { name: 'Mobile', value: 65 },
        { name: 'Desktop', value: 30 },
        { name: 'Tablet', value: 5 },
      ],
      trafficByState: [
        { id: 'CA', value: 1250 },
        { id: 'TX', value: 980 },
        { id: 'NY', value: 850 },
        { id: 'FL', value: 720 },
      ],
      conversionsByType: [
        { name: 'Form Fill', value: 450 },
        { name: 'Phone Call', value: 320 },
        { name: 'Email Click', value: 150 },
      ]
    };
  }
}
