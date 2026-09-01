import { PrismaService } from '../prisma/prisma.service';
export declare class SkillLoggerService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    logInvocation(params: {
        projectId: string;
        skillType: string;
        inputHash: string;
        model: string;
        tokens?: number;
        latencyMs?: number;
        outputHash?: string;
        status: 'success' | 'failed';
        error?: string;
    }): Promise<{
        error: string | null;
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        model: string;
        skillType: string;
        inputHash: string;
        tokens: number | null;
        latencyMs: number | null;
        outputHash: string | null;
        status: string;
    }>;
}
