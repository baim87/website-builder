import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Ga4Client } from './clients/ga4.client';
import { GtmClient } from './clients/gtm.client';
import { GscClient } from './clients/gsc.client';
import { getErrorMessage } from '../common/utils/error.util';

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

      // Only create if they don't exist yet (idempotency)
      if (!gtmContainerId) {
        gtmContainerId = await this.gtmClient.createContainer(domainName);
      }
      
      if (!propertyId || !measurementId) {
        const ga4 = await this.ga4Client.createPropertyAndStream(domainName);
        propertyId = ga4.propertyId;
        measurementId = ga4.measurementId;
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
      return { status: 'NOT_PROVISIONED' };
    }

    return {
      status: 'ACTIVE',
      gtmContainerId: analytics.gtmContainerId,
      ga4MeasurementId: analytics.ga4MeasurementId,
      gscStatus: analytics.gscVerificationStatus,
      trafficSummary: {
        visitors30d: 0,
        pageViews30d: 0,
      }
    };
  }
}
