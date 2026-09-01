import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AssetConversionProducer } from '../queue/producers/asset-conversion.producer';
export declare class AssetsService {
    private readonly prisma;
    private readonly storage;
    private readonly conversionProducer;
    constructor(prisma: PrismaService, storage: StorageService, conversionProducer: AssetConversionProducer);
    uploadAsset(projectId: string, file: Express.Multer.File, purpose: string, section?: string): Promise<{
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        url: string;
        purpose: string | null;
        convertedUrl: string | null;
        mimeType: string | null;
        source: string;
        sortOrder: number;
        section: string | null;
    }>;
    getAssets(projectId: string): Promise<{
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        url: string;
        purpose: string | null;
        convertedUrl: string | null;
        mimeType: string | null;
        source: string;
        sortOrder: number;
        section: string | null;
    }[]>;
    getAsset(projectId: string, assetId: string): Promise<{
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        url: string;
        purpose: string | null;
        convertedUrl: string | null;
        mimeType: string | null;
        source: string;
        sortOrder: number;
        section: string | null;
    }>;
    updateAsset(projectId: string, assetId: string, data: {
        purpose?: string;
        section?: string;
        sortOrder?: number;
    }): Promise<{
        id: string;
        projectId: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        url: string;
        purpose: string | null;
        convertedUrl: string | null;
        mimeType: string | null;
        source: string;
        sortOrder: number;
        section: string | null;
    }>;
    deleteAsset(projectId: string, assetId: string): Promise<{
        success: boolean;
    }>;
}
