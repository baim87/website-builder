import { ConfigService } from '@nestjs/config';
import { KeywordResult } from './interfaces/keyword-data.interface';
export declare class KeywordsCache {
    private readonly configService;
    private readonly redis;
    private readonly logger;
    private readonly TTL_SECONDS;
    constructor(configService: ConfigService);
    private getKey;
    get(trade: string, location: string): Promise<KeywordResult[] | null>;
    set(trade: string, location: string, results: KeywordResult[]): Promise<void>;
}
