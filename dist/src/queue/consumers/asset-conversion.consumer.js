"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetConversionConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const base_consumer_1 = require("./base.consumer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
const storage_service_1 = require("../../storage/storage.service");
const image_processor_service_1 = require("../../assets/image-processor.service");
const video_processor_service_1 = require("../../assets/video-processor.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const config_1 = require("@nestjs/config");
let AssetConversionConsumer = class AssetConversionConsumer extends base_consumer_1.BaseConsumer {
    storageService;
    imageProcessor;
    videoProcessor;
    prisma;
    configService;
    constructor(storageService, imageProcessor, videoProcessor, prisma, configService) {
        super();
        this.storageService = storageService;
        this.imageProcessor = imageProcessor;
        this.videoProcessor = videoProcessor;
        this.prisma = prisma;
        this.configService = configService;
    }
    async handleJob(job) {
        const { assetId, sourceUrl } = job.data;
        this.logger.log(`Starting conversion for asset ${assetId}`);
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) {
            this.logger.error(`Asset ${assetId} not found in DB`);
            return;
        }
        const publicUrl = this.configService.get('R2_PUBLIC_URL') || '';
        const originalKey = sourceUrl.replace(`${publicUrl}/`, '');
        const originalBuffer = await this.storageService.download(originalKey);
        let convertedBuffer;
        let newMimeType;
        let newExtension;
        if (asset.type === 'video') {
            convertedBuffer = await this.videoProcessor.convertToWebm(originalBuffer);
            newMimeType = 'video/webm';
            newExtension = '.webm';
        }
        else {
            convertedBuffer = await this.imageProcessor.convertToWebp(originalBuffer);
            newMimeType = 'image/webp';
            newExtension = '.webp';
        }
        const convertedKey = originalKey.replace('-original', newExtension);
        const convertedUrl = await this.storageService.upload(convertedKey, convertedBuffer, newMimeType);
        await this.prisma.asset.update({
            where: { id: assetId },
            data: {
                convertedUrl,
                mimeType: newMimeType,
            },
        });
        this.logger.log(`Completed conversion for asset ${assetId}`);
    }
};
exports.AssetConversionConsumer = AssetConversionConsumer;
exports.AssetConversionConsumer = AssetConversionConsumer = __decorate([
    (0, bullmq_1.Processor)(queue_names_constant_1.QUEUE_NAMES.ASSET_CONVERSION),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        image_processor_service_1.ImageProcessorService,
        video_processor_service_1.VideoProcessorService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], AssetConversionConsumer);
//# sourceMappingURL=asset-conversion.consumer.js.map