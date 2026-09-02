import { PrismaService } from '../prisma/prisma.service';
import { UpsertPageDto } from './dto/upsert-page.dto';
export declare class PageService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    upsertPage(projectId: string, slug: string, pageData: UpsertPageDto, userId?: string): Promise<{
        id: string;
        projectId: string;
        slug: string;
        content: import("@prisma/client/runtime/library").JsonValue;
        componentCode: import("@prisma/client/runtime/library").JsonValue | null;
        customCSS: string | null;
        seoMeta: import("@prisma/client/runtime/library").JsonValue | null;
        keywordTarget: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getPagesByProjectId(projectId: string, userId?: string): Promise<{
        id: string;
        projectId: string;
        slug: string;
        content: import("@prisma/client/runtime/library").JsonValue;
        componentCode: import("@prisma/client/runtime/library").JsonValue | null;
        customCSS: string | null;
        seoMeta: import("@prisma/client/runtime/library").JsonValue | null;
        keywordTarget: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
