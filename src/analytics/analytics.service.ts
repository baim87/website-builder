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
        
        // Mark events as conversions in GA4
        await this.ga4Client.markEventsAsConversions(propertyId, ['phone_click', 'form_submit', 'email_click']);
        
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

    if (ga4Data && ga4Data.overview) {
      if (ga4Data.overview.totals && ga4Data.overview.totals.length > 0) {
        const totalsRow = ga4Data.overview.totals[0];
        totalVisitors = parseInt(totalsRow.metricValues?.[0]?.value || '0', 10);
        avgBounceRate = parseFloat(totalsRow.metricValues?.[2]?.value || '0');
        avgConvRate = parseFloat(totalsRow.metricValues?.[3]?.value || '0');
        totalDuration = parseFloat(totalsRow.metricValues?.[4]?.value || '0');
      }

      if (ga4Data.overview.rows) {
        ga4Data.overview.rows.forEach(row => {
        const date = row.dimensionValues?.[0]?.value || 'Unknown';
        const rawChannel = row.dimensionValues?.[1]?.value || 'Unknown';
        const device = row.dimensionValues?.[2]?.value || 'Unknown';
        const region = row.dimensionValues?.[3]?.value || 'Unknown';

        const activeUsers = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const pageViews = parseInt(row.metricValues?.[1]?.value || '0', 10);

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
      });
      }
    }

    // Process conversions separately
    if (ga4Data && ga4Data.conversions && ga4Data.conversions.rows) {
      ga4Data.conversions.rows.forEach(row => {
        const rawEventName = row.dimensionValues?.[0]?.value || 'Unknown';
        const conversions = parseInt(row.metricValues?.[0]?.value || '0', 10);

        if (conversions > 0 && rawEventName !== 'Unknown' && rawEventName !== '(not set)') {
          let displayEventName = rawEventName;
          if (rawEventName === 'form_submit') displayEventName = 'Form Fill';
          if (rawEventName === 'phone_click') displayEventName = 'Phone Call';
          if (rawEventName === 'email_click') displayEventName = 'Email Click';

          conversionsByTypeMap[displayEventName] = (conversionsByTypeMap[displayEventName] || 0) + conversions;
          totalConversions += conversions;
        }
      });
    }

    // Merge realtime region data to populate the map immediately for new properties
    const realtimeData = await this.ga4Client.getRealtimeRegionReport(analytics.ga4PropertyId);
    if (realtimeData && realtimeData.rows) {
      realtimeData.rows.forEach(row => {
        const region = row.dimensionValues?.[0]?.value || 'Unknown';
        const activeUsers = parseInt(row.metricValues?.[0]?.value || '0', 10);
        
        if (activeUsers > 0 && region && region !== '(not set)' && region !== 'Unknown') {
          // A very rudimentary state name to code mapping for the map
          const stateCodes: Record<string, string> = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
          };
          
          const regionCode = stateCodes[region] || region.substring(0, 2).toUpperCase();
          trafficByStateMap[regionCode] = (trafficByStateMap[regionCode] || 0) + activeUsers;
        }
      });
    }

    // Merge realtime conversions
    const realtimeConversions = await this.ga4Client.getRealtimeConversionsReport(analytics.ga4PropertyId);
    if (realtimeConversions && realtimeConversions.rows) {
      realtimeConversions.rows.forEach(row => {
        const rawEventName = row.dimensionValues?.[0]?.value || 'Unknown';
        const conversions = parseInt(row.metricValues?.[0]?.value || '0', 10);

        if (conversions > 0 && rawEventName !== 'Unknown' && rawEventName !== '(not set)') {
          let displayEventName = rawEventName;
          if (rawEventName === 'form_submit') displayEventName = 'Form Fill';
          if (rawEventName === 'phone_click') displayEventName = 'Phone Call';
          if (rawEventName === 'email_click') displayEventName = 'Email Click';

          conversionsByTypeMap[displayEventName] = (conversionsByTypeMap[displayEventName] || 0) + conversions;
          // Note: we don't add to totalConversions or totalVisitors here to avoid skewing standard metric rates,
          // we just want them to show up on the real-time conversion chart.
        }
      });
    }

    const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return `${h}h ${m}m ${s}s`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    return {
      status: ANALYTICS_STATUS.ACTIVE,
      projectId: analytics.projectId,
      ga4PropertyId: analytics.ga4PropertyId,
      ga4MeasurementId: analytics.ga4MeasurementId,
      overview: {
        totalVisitors,
        totalVisitorsTrend: 0, 
        bounceRate: avgBounceRate.toFixed(1),
        bounceRateTrend: 0,
        conversionRate: avgConvRate.toFixed(1),
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

  async getRealtimeAnalytics(projectId: string, userId: string) {
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

    let activeUsersLast30Mins = 0;
    const usersPerMinuteMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) usersPerMinuteMap[i.toString()] = 0;

    const audienceMap: Record<string, number> = {};
    const pagesMap: Record<string, number> = {};
    const regionsMap: Record<string, number> = {};

    const cityToState: Record<string, string> = {
      'New York': 'NY', 'Los Angeles': 'CA', 'Chicago': 'IL', 'Houston': 'TX', 'Phoenix': 'AZ',
      'Philadelphia': 'PA', 'San Antonio': 'TX', 'San Diego': 'CA', 'Dallas': 'TX', 'San Jose': 'CA',
      'Austin': 'TX', 'Jacksonville': 'FL', 'Fort Worth': 'TX', 'Columbus': 'OH', 'Charlotte': 'NC',
      'San Francisco': 'CA', 'Indianapolis': 'IN', 'Seattle': 'WA', 'Denver': 'CO', 'Washington': 'DC',
      'Boston': 'MA', 'El Paso': 'TX', 'Nashville': 'TN', 'Detroit': 'MI', 'Oklahoma City': 'OK',
      'Portland': 'OR', 'Las Vegas': 'NV', 'Memphis': 'TN', 'Louisville': 'KY', 'Baltimore': 'MD',
      'Milwaukee': 'WI', 'Albuquerque': 'NM', 'Tucson': 'AZ', 'Fresno': 'CA', 'Mesa': 'AZ',
      'Sacramento': 'CA', 'Atlanta': 'GA', 'Kansas City': 'MO', 'Colorado Springs': 'CO', 'Miami': 'FL',
      'Raleigh': 'NC', 'Omaha': 'NE', 'Long Beach': 'CA', 'Virginia Beach': 'VA', 'Oakland': 'CA',
      'Minneapolis': 'MN', 'Tulsa': 'OK', 'Arlington': 'TX', 'Tampa': 'FL', 'New Orleans': 'LA',
      'Wichita': 'KS', 'Cleveland': 'OH', 'Bakersfield': 'CA', 'Aurora': 'CO', 'Anaheim': 'CA',
      'Honolulu': 'HI', 'Santa Ana': 'CA', 'Riverside': 'CA', 'Corpus Christi': 'TX', 'Lexington': 'KY',
      'Stockton': 'CA', 'Henderson': 'NV', 'Saint Paul': 'MN', 'St. Louis': 'MO', 'Cincinnati': 'OH',
      'Pittsburgh': 'PA', 'Greensboro': 'NC', 'Anchorage': 'AK', 'Plano': 'TX', 'Lincoln': 'NE',
      'Orlando': 'FL', 'Irvine': 'CA', 'Newark': 'NJ', 'Toledo': 'OH', 'Durham': 'NC', 'Chula Vista': 'CA',
      'Fort Wayne': 'IN', 'Jersey City': 'NJ', 'St. Petersburg': 'FL', 'Laredo': 'TX', 'Madison': 'WI',
      'Chandler': 'AZ', 'Buffalo': 'NY', 'Lubbock': 'TX', 'Scottsdale': 'AZ', 'Reno': 'NV',
      'Glendale': 'AZ', 'Gilbert': 'AZ', 'Winston-Salem': 'NC', 'North Las Vegas': 'NV', 'Norfolk': 'VA',
      'Chesapeake': 'VA', 'Garland': 'TX', 'Irving': 'TX', 'Hialeah': 'FL', 'Fremont': 'CA',
      'Boise': 'ID', 'Richmond': 'VA', 'Baton Rouge': 'LA', 'Spokane': 'WA', 'Des Moines': 'IA',
      'Tacoma': 'WA', 'San Bernardino': 'CA', 'Modesto': 'CA', 'Fontana': 'CA', 'Santa Clarita': 'CA',
      'Birmingham': 'AL', 'Oxnard': 'CA', 'Fayetteville': 'NC', 'Moreno Valley': 'CA', 'Rochester': 'NY',
      'Huntington Beach': 'CA', 'Salt Lake City': 'UT', 'Grand Rapids': 'MI',
      'Amarillo': 'TX', 'Yonkers': 'NY', 'Montgomery': 'AL', 'Akron': 'OH',
      'Little Rock': 'AR', 'Huntsville': 'AL', 'Augusta': 'GA', 'Port St. Lucie': 'FL',
      'Grand Prairie': 'TX', 'Tallahassee': 'FL', 'Overland Park': 'KS',
      'Tempe': 'AZ', 'McKinney': 'TX', 'Mobile': 'AL', 'Cape Coral': 'FL', 'Shreveport': 'LA',
      'Frisco': 'TX', 'Knoxville': 'TN', 'Worcester': 'MA', 'Brownsville': 'TX', 'Vancouver': 'WA',
      'Fort Lauderdale': 'FL', 'Sioux Falls': 'SD', 'Ontario': 'CA', 'Chattanooga': 'TN', 'Providence': 'RI',
      'Newport News': 'VA', 'Rancho Cucamonga': 'CA', 'Santa Rosa': 'CA', 'Peoria': 'AZ', 'Oceanside': 'CA',
      'Elk Grove': 'CA', 'Salem': 'OR', 'Pembroke Pines': 'FL', 'Eugene': 'OR', 'Garden Grove': 'CA',
      'Cary': 'NC', 'Fort Collins': 'CO', 'Corona': 'CA', 'Springfield': 'MO', 'Jackson': 'MS',
      'Alexandria': 'VA', 'Hayward': 'CA', 'Clarksville': 'TN', 'Lakewood': 'CO', 'Lancaster': 'CA',
      'Salinas': 'CA', 'Palmdale': 'CA', 'Hollywood': 'FL', 'Pasadena': 'TX', 'Macon': 'GA',
      'Pomona': 'CA', 'Sunnyvale': 'CA', 'Escondido': 'CA', 'Paterson': 'NJ', 'Joliet': 'IL',
      'Naperville': 'IL', 'Rockford': 'IL', 'Torrance': 'CA', 'Syracuse': 'NY', 'Bridgeport': 'CT',
      'Mesquite': 'TX', 'Savannah': 'GA', 'Orange': 'CA',
      'Fullerton': 'CA', 'Dayton': 'OH', 'Miramar': 'FL', 'Olathe': 'KS', 'Thornton': 'CO',
      'Waco': 'TX', 'Carrollton': 'TX', 'West Valley City': 'UT', 'Denton': 'TX', 'Warren': 'MI',
      'Roseville': 'CA', 'Visalia': 'CA', 'Victorville': 'CA', 'Thousand Oaks': 'CA', 'Elizabeth': 'NJ',
      'Cedar Rapids': 'IA', 'Topeka': 'KS', 'Fargo': 'ND', 'Wausau': 'WI', 'Weston': 'WI', 'Merrill': 'WI',
      'Stevens Point': 'WI'
    };

    try {
      const results = await Promise.allSettled([
        this.ga4Client['gaDataClient'].runRealtimeReport({
          property: `properties/${analytics.ga4PropertyId}`,
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'minutesAgo' }],
        }),
        this.ga4Client['gaDataClient'].runRealtimeReport({
          property: `properties/${analytics.ga4PropertyId}`,
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'unifiedScreenName' }],
        }),
        this.ga4Client['gaDataClient'].runRealtimeReport({
          property: `properties/${analytics.ga4PropertyId}`,
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'audienceName' }],
        }),
        this.ga4Client['gaDataClient'].runRealtimeReport({
          property: `properties/${analytics.ga4PropertyId}`,
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'city' }],
        })
      ]);

      const [minRes, screenRes, audRes, cityRes] = results;

      if (minRes.status === 'fulfilled' && minRes.value[0]?.rows) {
        minRes.value[0].rows.forEach((row: any) => {
          const min = row.dimensionValues?.[0]?.value || '0';
          const val = parseInt(row.metricValues?.[0]?.value || '0', 10);
          activeUsersLast30Mins += val;
          if (usersPerMinuteMap[min] !== undefined) usersPerMinuteMap[min] += val;
        });
      }

      if (screenRes.status === 'fulfilled' && screenRes.value[0]?.rows) {
        screenRes.value[0].rows.forEach((row: any) => {
          const page = row.dimensionValues?.[0]?.value || 'Unknown';
          const val = parseInt(row.metricValues?.[0]?.value || '0', 10);
          if (val > 0 && page !== '(not set)' && page !== 'Unknown') pagesMap[page] = val;
        });
      }

      if (audRes.status === 'fulfilled' && audRes.value[0]?.rows) {
        audRes.value[0].rows.forEach((row: any) => {
          const aud = row.dimensionValues?.[0]?.value || 'All Users';
          const val = parseInt(row.metricValues?.[0]?.value || '0', 10);
          if (val > 0 && aud !== '(not set)') audienceMap[aud] = val;
        });
      }

      if (cityRes.status === 'fulfilled' && cityRes.value[0]?.rows) {
        cityRes.value[0].rows.forEach((row: any) => {
          const city = row.dimensionValues?.[0]?.value || 'Unknown';
          const val = parseInt(row.metricValues?.[0]?.value || '0', 10);
          if (val > 0 && city !== '(not set)' && city !== 'Unknown') {
            const state = cityToState[city] || city;
            regionsMap[state] = (regionsMap[state] || 0) + val;
          }
        });
      }
    } catch (e) {
      this.logger.error('Error fetching realtime parallel reports', e);
    }

    if (!audienceMap['All Users']) {
       audienceMap['All Users'] = activeUsersLast30Mins;
    }

    return {
      status: ANALYTICS_STATUS.ACTIVE,
      activeUsersLast30Mins,
      usersPerMinute: Object.entries(usersPerMinuteMap).map(([minute, count]) => ({
        minute: `-${minute} min`,
        count
      })).reverse(),
      usersBySource: [], // Deprecated in realtime due to GA4 limitations
      usersByAudience: Object.entries(audienceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      usersByPageTitle: Object.entries(pagesMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      usersByRegion: Object.entries(regionsMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }
}
