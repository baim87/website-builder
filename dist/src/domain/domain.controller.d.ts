import { DomainService } from './domain.service';
export declare class DomainController {
    private readonly domainService;
    constructor(domainService: DomainService);
    search(query: string): Promise<{
        domainName: string;
        available: any;
        price: any;
        period: any;
    } | {
        error: string;
    }>;
    purchase(projectId: string, domainName: string, expectedPrice: number, req: any): Promise<{
        success: boolean;
        domain: {
            id: string;
            projectId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            domainName: string;
            provider: string | null;
        };
        mocked: any;
    }>;
}
