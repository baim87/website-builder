import { WebsiteDataService } from '../projects/website-data.service';
import { GenerationProducer } from '../queue/producers/generation.producer';
export declare class EditExecutorService {
    private readonly websiteDataService;
    private readonly generationProducer;
    private readonly logger;
    constructor(websiteDataService: WebsiteDataService, generationProducer: GenerationProducer);
    applyEdits(projectId: string, intent: any, currentWebsiteData: any): Promise<void>;
}
