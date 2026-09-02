import { SiteContentService } from './site-content.service';
export declare class PublicSiteController {
    private readonly siteContentService;
    constructor(siteContentService: SiteContentService);
    getSiteContent(projectId: string, apiKey: string): Promise<any>;
}
