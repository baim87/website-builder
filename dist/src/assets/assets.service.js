"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_service_1 = require("../storage/storage.service");
const asset_conversion_producer_1 = require("../queue/producers/asset-conversion.producer");
const crypto = __importStar(require("crypto"));
let AssetsService = class AssetsService {
    prisma;
    storage;
    conversionProducer;
    constructor(prisma, storage, conversionProducer) {
        this.prisma = prisma;
        this.storage = storage;
        this.conversionProducer = conversionProducer;
    }
    async uploadAsset(projectId, file, purpose, section) {
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');
        let mimeType = file.mimetype;
        let url = '';
        const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex');
        const baseKey = `projects/${projectId}/assets/${fileHash}`;
        const originalKey = `${baseKey}-original`;
        url = await this.storage.upload(originalKey, file.buffer, mimeType);
        let assetType = 'document';
        if (isImage)
            assetType = 'image';
        if (isVideo)
            assetType = 'video';
        const asset = await this.prisma.asset.create({
            data: {
                projectId,
                url,
                type: assetType,
                mimeType,
                purpose,
                source: 'upload',
                section,
            },
        });
        const isRasterImageToConvert = isImage && !['image/webp', 'image/svg+xml', 'image/gif'].includes(mimeType);
        const isVideoToConvert = isVideo && mimeType !== 'video/webm';
        if (isRasterImageToConvert || isVideoToConvert) {
            await this.conversionProducer.convertAsset(projectId, asset.id, url);
        }
        else if (mimeType === 'image/webp' || mimeType === 'video/webm') {
            await this.prisma.asset.update({
                where: { id: asset.id },
                data: { convertedUrl: url },
            });
        }
        return asset;
    }
    async getAssets(projectId) {
        return this.prisma.asset.findMany({
            where: { projectId },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async getAsset(projectId, assetId) {
        const asset = await this.prisma.asset.findFirst({ where: { id: assetId, projectId } });
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${assetId} not found or access denied`);
        }
        return asset;
    }
    async updateAsset(projectId, assetId, data) {
        await this.getAsset(projectId, assetId);
        return this.prisma.asset.update({
            where: { id: assetId },
            data,
        });
    }
    async deleteAsset(projectId, assetId) {
        const asset = await this.getAsset(projectId, assetId);
        try {
            const originalKey = asset.url.split('/').pop();
            if (originalKey)
                await this.storage.delete(`projects/${asset.projectId}/assets/${originalKey}`);
            if (asset.convertedUrl) {
                const convertedKey = asset.convertedUrl.split('/').pop();
                if (convertedKey)
                    await this.storage.delete(`projects/${asset.projectId}/assets/${convertedKey}`);
            }
        }
        catch (e) { }
        await this.prisma.asset.delete({ where: { id: assetId } });
        return { success: true };
    }
};
exports.AssetsService = AssetsService;
exports.AssetsService = AssetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => asset_conversion_producer_1.AssetConversionProducer))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        asset_conversion_producer_1.AssetConversionProducer])
], AssetsService);
//# sourceMappingURL=assets.service.js.map