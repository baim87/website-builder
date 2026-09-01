"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ImageProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessorService = void 0;
const common_1 = require("@nestjs/common");
const sharp = require("sharp");
let ImageProcessorService = ImageProcessorService_1 = class ImageProcessorService {
    logger = new common_1.Logger(ImageProcessorService_1.name);
    async convertToWebp(buffer) {
        try {
            return await sharp(buffer)
                .webp({ quality: 80, effort: 4 })
                .toBuffer();
        }
        catch (e) {
            this.logger.error('Failed to convert image to WebP', e.stack);
            throw e;
        }
    }
    async extractMetadata(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
            };
        }
        catch (e) {
            this.logger.error('Failed to extract image metadata', e.stack);
            return null;
        }
    }
};
exports.ImageProcessorService = ImageProcessorService;
exports.ImageProcessorService = ImageProcessorService = ImageProcessorService_1 = __decorate([
    (0, common_1.Injectable)()
], ImageProcessorService);
//# sourceMappingURL=image-processor.service.js.map