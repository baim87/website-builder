import { PrismaService } from '../prisma/prisma.service';
import { VercelClient } from '../vercel/vercel.client';
export declare class DeploymentService {
    private readonly prisma;
    private readonly vercelClient;
    private readonly logger;
    constructor(prisma: PrismaService, vercelClient: VercelClient);
    deployProject(projectId: string, userId: string): Promise<{
        success: boolean;
        deploymentId: string;
        status: string;
        url: string;
        project: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            userId: string;
            status: string;
        };
    }>;
    getDeploymentStatus(projectId: string, userId: string): Promise<{
        projectId: string;
        status: string;
        ready: boolean;
    }>;
    revalidateProject(projectId: string, userId: string, path?: string): Promise<{
        success: boolean;
        path: string;
        domain: string;
        result: any;
    }>;
}
