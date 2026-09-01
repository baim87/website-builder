import { ConfigService } from '@nestjs/config';
import { GoogleAuthClient } from './google-auth.client';
export declare class Ga4Client {
    private readonly configService;
    private readonly authClient;
    private readonly logger;
    private gaAdminClient;
    constructor(configService: ConfigService, authClient: GoogleAuthClient);
    createPropertyAndStream(domainName: string): Promise<{
        propertyId: string;
        measurementId: string;
    }>;
}
