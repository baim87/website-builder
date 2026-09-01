import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateProjectDto): Promise<{
        businessContext: {
            id: string;
            projectId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            hours: import("@prisma/client/runtime/library").JsonValue | null;
            services: import("@prisma/client/runtime/library").JsonValue | null;
            businessName: string | null;
            contactPerson: string | null;
            businessAddress: string | null;
            phone: string | null;
            gbpData: import("@prisma/client/runtime/library").JsonValue | null;
            trade: string | null;
            serviceAreas: import("@prisma/client/runtime/library").JsonValue | null;
            brandIdentityInputs: import("@prisma/client/runtime/library").JsonValue | null;
            brandVoicePreference: string | null;
            usps: import("@prisma/client/runtime/library").JsonValue | null;
            interviewMetadata: import("@prisma/client/runtime/library").JsonValue | null;
            location: string | null;
            targetAudience: string | null;
            competitors: import("@prisma/client/runtime/library").JsonValue | null;
            rawText: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        userId: string;
        status: string;
    }>;
    findAll(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        userId: string;
        status: string;
    }[]>;
    findOne(id: string, userId?: string): Promise<{
        businessContext: {
            id: string;
            projectId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            hours: import("@prisma/client/runtime/library").JsonValue | null;
            services: import("@prisma/client/runtime/library").JsonValue | null;
            businessName: string | null;
            contactPerson: string | null;
            businessAddress: string | null;
            phone: string | null;
            gbpData: import("@prisma/client/runtime/library").JsonValue | null;
            trade: string | null;
            serviceAreas: import("@prisma/client/runtime/library").JsonValue | null;
            brandIdentityInputs: import("@prisma/client/runtime/library").JsonValue | null;
            brandVoicePreference: string | null;
            usps: import("@prisma/client/runtime/library").JsonValue | null;
            interviewMetadata: import("@prisma/client/runtime/library").JsonValue | null;
            location: string | null;
            targetAudience: string | null;
            competitors: import("@prisma/client/runtime/library").JsonValue | null;
            rawText: string | null;
        } | null;
        websiteData: {
            id: string;
            projectId: string;
            createdAt: Date;
            updatedAt: Date;
            typography: import("@prisma/client/runtime/library").JsonValue | null;
            colorPalette: import("@prisma/client/runtime/library").JsonValue | null;
            style: string | null;
            sitemap: import("@prisma/client/runtime/library").JsonValue | null;
            designTokens: import("@prisma/client/runtime/library").JsonValue | null;
            seoMetadata: import("@prisma/client/runtime/library").JsonValue | null;
            sitemapXml: string | null;
            robotsTxt: string | null;
            jsonLdSchemas: import("@prisma/client/runtime/library").JsonValue | null;
            ogTags: import("@prisma/client/runtime/library").JsonValue | null;
            internalLinkMap: import("@prisma/client/runtime/library").JsonValue | null;
            generationStatus: string;
            lastGeneratedAt: Date | null;
        } | null;
        domain: {
            id: string;
            projectId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            domainName: string;
            provider: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        userId: string;
        status: string;
    }>;
    delete(id: string, userId?: string): Promise<{
        success: boolean;
    }>;
}
