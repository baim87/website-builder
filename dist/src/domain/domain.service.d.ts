import { PrismaService } from '../prisma/prisma.service';
import { VercelClient } from '../vercel/vercel.client';
export declare class DomainService {
    private readonly prisma;
    private readonly vercelClient;
    private readonly logger;
    constructor(prisma: PrismaService, vercelClient: VercelClient);
    searchDomain(query: string): Promise<{
        domainName: string;
        available: any;
        price: any;
        period: any;
    }>;
    purchaseDomain(projectId: string, userId: string, domainName: string, expectedPrice: number): Promise<{
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
