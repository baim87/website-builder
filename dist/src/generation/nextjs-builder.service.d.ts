import { ConfigService } from '@nestjs/config';
import { BusinessContextService } from '../projects/business-context.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { PageService } from '../projects/page.service';
export declare class NextjsBuilderService {
    private readonly configService;
    private readonly businessContextService;
    private readonly websiteDataService;
    private readonly pageService;
    private readonly logger;
    constructor(configService: ConfigService, businessContextService: BusinessContextService, websiteDataService: WebsiteDataService, pageService: PageService);
    buildAndDeploy(projectId: string, userId?: string): Promise<string>;
}
