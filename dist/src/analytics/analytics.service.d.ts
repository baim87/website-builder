import { PrismaService } from '../prisma/prisma.service';
import { Ga4Client } from './clients/ga4.client';
import { GtmClient } from './clients/gtm.client';
import { GscClient } from './clients/gsc.client';
export declare class AnalyticsService {
    private readonly prisma;
    private readonly ga4Client;
    private readonly gtmClient;
    private readonly gscClient;
    private readonly logger;
    constructor(prisma: PrismaService, ga4Client: Ga4Client, gtmClient: GtmClient, gscClient: GscClient);
    provisionAnalytics(projectId: string, domainName: string): Promise<{
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        ga4PropertyId: string | null;
        ga4MeasurementId: string | null;
        gtmContainerId: string | null;
        gscUrl: string | null;
        gscSiteUrl: string | null;
        gscVerificationStatus: string | null;
        leadNotificationEmail: string | null;
    }>;
    getAnalyticsSummary(projectId: string, userId: string): Promise<{
        status: string;
        gtmContainerId?: undefined;
        ga4MeasurementId?: undefined;
        gscStatus?: undefined;
        trafficSummary?: undefined;
    } | {
        status: string;
        gtmContainerId: string | null;
        ga4MeasurementId: string | null;
        gscStatus: string | null;
        trafficSummary: {
            visitors30d: number;
            pageViews30d: number;
        };
    }>;
}
