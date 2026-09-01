import { OrchestratorService } from '../skills/orchestrator.service';
import { WebsiteDataService } from '../projects/website-data.service';
import { BusinessContextService } from '../projects/business-context.service';
import { PageService } from '../projects/page.service';
import { SeoArtifactsService } from '../seo/seo-artifacts.service';
import { NextjsBuilderService } from './nextjs-builder.service';
export declare class GenerationService {
    private readonly orchestrator;
    private readonly websiteDataService;
    private readonly businessContextService;
    private readonly pageService;
    private readonly seoArtifacts;
    private readonly nextjsBuilder;
    private readonly logger;
    constructor(orchestrator: OrchestratorService, websiteDataService: WebsiteDataService, businessContextService: BusinessContextService, pageService: PageService, seoArtifacts: SeoArtifactsService, nextjsBuilder: NextjsBuilderService);
    generateProject(projectId: string): Promise<string>;
}
