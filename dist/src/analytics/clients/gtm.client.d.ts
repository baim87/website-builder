import { ConfigService } from '@nestjs/config';
import { GoogleAuthClient } from './google-auth.client';
export declare class GtmClient {
    private readonly configService;
    private readonly authClient;
    private readonly logger;
    private gtmApi;
    constructor(configService: ConfigService, authClient: GoogleAuthClient);
    createContainer(domainName: string): Promise<string | null | undefined>;
}
