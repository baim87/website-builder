import { ConfigService } from '@nestjs/config';
export declare class GooglePlacesService {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    constructor(configService: ConfigService);
    scrapeGoogleBusinessProfile(queryOrUrl: string): Promise<any>;
    getCitiesInRadius(location: string, radiusMiles: number): Promise<string[]>;
}
