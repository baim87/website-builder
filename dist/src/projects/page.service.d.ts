import { PrismaService } from '../prisma/prisma.service';
export declare class PageService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    upsertPage(projectId: string, slug: string, content: any, userId?: string): Promise<{
        id: string;
        projectId: string;
        slug: string;
        content: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getPagesByProjectId(projectId: string, userId?: string): Promise<{
        id: string;
        projectId: string;
        slug: string;
        content: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
