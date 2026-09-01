import { AssetsService } from './assets.service';
export declare class AssetsController {
    private readonly assetsService;
    constructor(assetsService: AssetsService);
    upload(projectId: string, file: Express.Multer.File, purpose: string, section?: string): Promise<{
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
    findAll(projectId: string): Promise<{
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
    findOne(projectId: string, assetId: string): Promise<{
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
    update(projectId: string, assetId: string, body: {
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
    remove(projectId: string, assetId: string): Promise<{
        success: boolean;
    }>;
}
