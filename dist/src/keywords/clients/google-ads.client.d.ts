import { ConfigService } from '@nestjs/config';
import { KeywordResult } from '../interfaces/keyword-data.interface';
export declare class GoogleAdsClient {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    fetchKeywords(trade: string, location: string): Promise<KeywordResult[]>;
}
