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

    const businessContext = await this.prisma.businessContext.findUnique({ where: { projectId } });
    const businessName = businessContext?.businessName || 'Business';

    try {
      let propertyId = existing?.ga4PropertyId;
      let measurementId = existing?.ga4MeasurementId;
      let gtmContainerId = existing?.gtmContainerId;

      let gtmInternalId: string | undefined;

      // Only create if they don't exist yet (idempotency)
      if (!propertyId || !measurementId) {
        const ga4 = await this.ga4Client.createPropertyAndStream(domainName, businessName);
        propertyId = ga4.propertyId;
        measurementId = ga4.measurementId;
      }

      if (!gtmContainerId) {
        const gtm = await this.gtmClient.createContainer(domainName, businessName);
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
      // Persist to database immediately (upsert to handle retries cleanly)
      await this.prisma.siteAnalytics.upsert({
        where: { projectId },
        create: {
          projectId,
          ga4PropertyId: propertyId!,
          ga4MeasurementId: measurementId!,
          gtmContainerId: gtmContainerId!,
          gscSiteUrl: `https://${domainName}`,
          gscVerificationStatus: 'PENDING',
        },
        update: {
          ga4PropertyId: propertyId!,
          ga4MeasurementId: measurementId!,
          gtmContainerId: gtmContainerId!,
          gscSiteUrl: `https://${domainName}`,
        }
      });

      // Attempt GSC Verification
      let gscStatus = 'PENDING';
      try {
        await this.gscClient.verifySite(domainName);
        gscStatus = 'VERIFIED';
        
        await this.prisma.siteAnalytics.update({
          where: { projectId },
          data: { gscVerificationStatus: gscStatus }
        });
      } catch (e) {
        this.logger.warn(`GSC Provisioning delayed for ${domainName} (DNS likely not propagated). Will retry via BullMQ. Error: ${getErrorMessage(e)}`);
        // Throwing error causes BullMQ to retry the job according to the backoff strategy
        throw new Error(`GSC Verification failed: ${getErrorMessage(e)}`);
      }

      this.logger.log(`Successfully provisioned all analytics for ${projectId}`);
      return await this.prisma.siteAnalytics.findUnique({ where: { projectId } });
    } catch (error) {
      this.logger.error(`Analytics provisioning job failed: ${getErrorMessage(error)}`);
      throw error; // Rethrow so BullMQ knows it failed and will retry
    }
  }

  async getAnalyticsSummary(projectId: string, userId: string, period: string = '30d') {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
    });

    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const analytics = await this.prisma.siteAnalytics.findUnique({
      where: { projectId },
    });

    if (!analytics || !analytics.ga4PropertyId) {
      return { status: ANALYTICS_STATUS.NOT_PROVISIONED };
    }

    const ga4Data = await this.ga4Client.getAnalyticsReport(analytics.ga4PropertyId, period);

    // Initialize default zeroes
    let totalVisitors = 0;
    let totalPageViews = 0;
    let avgBounceRate = 0;
    let avgConvRate = 0;
    let totalDuration = 0;
    let totalConversions = 0;
    
    // Aggregation maps
    const trafficOverTimeMap: Record<string, { visitors: number; pageViews: number }> = {};
    const trafficSourcesMap: Record<string, number> = {};
    const devicesMap: Record<string, number> = {};
    const trafficByStateMap: Record<string, number> = {};
    const conversionsByTypeMap: Record<string, number> = {};

    let rowCount = 0;

    if (ga4Data && ga4Data.rows) {
      ga4Data.rows.forEach(row => {
        const date = row.dimensionValues?.[0]?.value || 'Unknown';
        const rawChannel = row.dimensionValues?.[1]?.value || 'Unknown';
        const device = row.dimensionValues?.[2]?.value || 'Unknown';
        const region = row.dimensionValues?.[3]?.value || 'Unknown';
        const rawEventName = row.dimensionValues?.[4]?.value || 'Unknown';

        const activeUsers = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const pageViews = parseInt(row.metricValues?.[1]?.value || '0', 10);
        const bounceRate = parseFloat(row.metricValues?.[2]?.value || '0');
        const convRate = parseFloat(row.metricValues?.[3]?.value || '0');
        const avgDuration = parseFloat(row.metricValues?.[4]?.value || '0');
        const conversions = parseInt(row.metricValues?.[5]?.value || '0', 10);

        totalVisitors += activeUsers;
        totalPageViews += pageViews;
        avgBounceRate += bounceRate;
        avgConvRate += convRate;
        totalDuration += avgDuration;
        totalConversions += conversions;
        rowCount++;

        // Format Date (YYYYMMDD to readable)
        const dateKey = date.length === 8 ? `${date.substring(4, 6)}/${date.substring(6, 8)}` : date;
        if (!trafficOverTimeMap[dateKey]) trafficOverTimeMap[dateKey] = { visitors: 0, pageViews: 0 };
        trafficOverTimeMap[dateKey].visitors += activeUsers;
        trafficOverTimeMap[dateKey].pageViews += pageViews;

        // Channel
        if (activeUsers > 0) {
          // Normalize channel to match exact requested values
          let displayChannel = rawChannel;
          if (rawChannel.includes('Social')) displayChannel = 'Social';
          else if (rawChannel === 'Organic Search' || rawChannel === 'Direct' || rawChannel === 'Referral') {
            displayChannel = rawChannel;
          } else if (rawChannel !== 'Unknown') {
            displayChannel = 'Other'; // Group others, but ideally we stick to the requested 4
          }

          if (displayChannel !== 'Unknown') {
            trafficSourcesMap[displayChannel] = (trafficSourcesMap[displayChannel] || 0) + activeUsers;
          }
          devicesMap[device] = (devicesMap[device] || 0) + activeUsers;
          
          if (region && region !== '(not set)' && region !== 'Unknown') {
             const regionCode = region.substring(0, 2).toUpperCase(); 
             trafficByStateMap[regionCode] = (trafficByStateMap[regionCode] || 0) + activeUsers;
          }
        }

        // Conversions
        if (conversions > 0 && rawEventName !== 'Unknown' && rawEventName !== '(not set)') {
          let displayEventName = rawEventName;
          if (rawEventName === 'form_submit') displayEventName = 'Form Fill';
          if (rawEventName === 'phone_click') displayEventName = 'Phone Call';
          if (rawEventName === 'email_click') displayEventName = 'Email Click';

          conversionsByTypeMap[displayEventName] = (conversionsByTypeMap[displayEventName] || 0) + conversions;
        }
      });
    }

    if (rowCount > 0) {
      avgBounceRate = avgBounceRate / rowCount;
      avgConvRate = avgConvRate / rowCount;
      totalDuration = totalDuration / rowCount;
    }

    const formatDuration = (seconds: number) => {
      if (!seconds) return '0s';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    return {
      status: ANALYTICS_STATUS.ACTIVE,
      gtmContainerId: analytics.gtmContainerId,
      ga4MeasurementId: analytics.ga4MeasurementId,
      gscStatus: analytics.gscVerificationStatus,
      overview: {
        totalVisitors,
        visitorsTrend: 0, // Need historical query for trends
        bounceRate: parseFloat((avgBounceRate * 100).toFixed(1)),
        bounceRateTrend: 0,
        conversionRate: parseFloat((avgConvRate * 100).toFixed(1)),
        conversionRateTrend: 0,
        avgSessionDuration: formatDuration(totalDuration),
      },
      trafficOverTime: Object.entries(trafficOverTimeMap).map(([name, data]) => ({ name, ...data })).sort((a,b) => a.name.localeCompare(b.name)),
      trafficSources: Object.entries(trafficSourcesMap).map(([name, value]) => ({ name, value })),
      devices: Object.entries(devicesMap).map(([name, value]) => ({ name, value })),
      trafficByState: Object.entries(trafficByStateMap).map(([id, value]) => ({ id, value })),
      conversionsByType: Object.entries(conversionsByTypeMap).map(([name, value]) => ({ name, value })),
    };
  }

  async updateAnalyticsDomain(projectId: string, newDomainName: string) {
    this.logger.log(`Updating analytics domain for project ${projectId} to ${newDomainName}`);

    const existing = await this.prisma.siteAnalytics.findUnique({ where: { projectId } });
    if (!existing || !existing.ga4PropertyId) {
      this.logger.warn(`No analytics found for project ${projectId}. Skipping update.`);
      return;
    }

    try {
      await this.ga4Client.updateDataStreamUrl(existing.ga4PropertyId, newDomainName);

      // We should also update the GSC Site URL and reset verification if needed
      await this.prisma.siteAnalytics.update({
        where: { projectId },
        data: {
          gscSiteUrl: `https://${newDomainName}`,
          gscVerificationStatus: 'PENDING',
        }
      });
      
      try {
        await this.gscClient.verifySite(newDomainName);
        await this.prisma.siteAnalytics.update({
          where: { projectId },
          data: { gscVerificationStatus: 'VERIFIED' }
        });
      } catch (e) {
        this.logger.warn(`GSC Verification failed for new domain ${newDomainName}: ${getErrorMessage(e)}`);
      }

      this.logger.log(`Successfully updated analytics domain for ${projectId}`);
    } catch (error) {
      this.logger.error(`Analytics domain update failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}
