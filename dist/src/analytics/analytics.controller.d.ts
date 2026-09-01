import { AnalyticsService } from './analytics.service';
import { AnalyticsProvisioningProducer } from '../queue/producers/analytics-provisioning.producer';
export declare class AnalyticsController {
    private readonly analyticsService;
    private readonly analyticsProducer;
    constructor(analyticsService: AnalyticsService, analyticsProducer: AnalyticsProvisioningProducer);
    getSummary(projectId: string, req: any): Promise<{
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
    provision(projectId: string, domainName: string): Promise<{
        status: string;
        message: string;
    }>;
}
