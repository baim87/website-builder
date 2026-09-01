import { ConfigService } from '@nestjs/config';
export declare class GbpService {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    private readonly client;
    constructor(configService: ConfigService);
    lookup(businessName: string, location: string): Promise<any>;
}
