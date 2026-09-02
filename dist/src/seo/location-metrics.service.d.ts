import { ConfigService } from '@nestjs/config';
import { GoogleAdsClient } from '../keywords/clients/google-ads.client';
import { PrismaService } from '../prisma/prisma.service';
export declare class LocationMetricsService {
    private readonly configService;
    private readonly googleAdsClient;
    private readonly prisma;
    private readonly logger;
    private readonly mapsClient;
    private readonly apiKey;
    constructor(configService: ConfigService, googleAdsClient: GoogleAdsClient, prisma: PrismaService);
    processProjectMetrics(projectId: string, baseLocation: string, radiusMiles: number, services: string[]): Promise<void>;
    private getCitiesInRadius;
    private saveMetrics;
}
