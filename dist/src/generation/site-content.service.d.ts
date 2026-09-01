import { PrismaService } from '../prisma/prisma.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { RedisService } from '../common/redis/redis.service';
export declare class SiteContentService {
    private readonly prisma;
    private readonly websiteDataService;
    private readonly businessContextService;
    private readonly redisService;
    private readonly logger;
    private readonly CACHE_TTL_SECONDS;
    constructor(prisma: PrismaService, websiteDataService: WebsiteDataService, businessContextService: BusinessContextService, redisService: RedisService);
    getSiteContent(projectId: string, userId?: string, bypassCache?: boolean): Promise<any>;
    invalidateCache(projectId: string): Promise<void>;
    private mapToSiteContent;
}
