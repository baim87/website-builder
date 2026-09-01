"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetsModule = void 0;
const common_1 = require("@nestjs/common");
const assets_service_1 = require("./assets.service");
const assets_controller_1 = require("./assets.controller");
const image_processor_service_1 = require("./image-processor.service");
const video_processor_service_1 = require("./video-processor.service");
const prisma_module_1 = require("../prisma/prisma.module");
const storage_module_1 = require("../storage/storage.module");
const queue_module_1 = require("../queue/queue.module");
let AssetsModule = class AssetsModule {
};
exports.AssetsModule = AssetsModule;
exports.AssetsModule = AssetsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, storage_module_1.StorageModule, (0, common_1.forwardRef)(() => queue_module_1.QueueModule)],
        controllers: [assets_controller_1.AssetsController],
        providers: [assets_service_1.AssetsService, image_processor_service_1.ImageProcessorService, video_processor_service_1.VideoProcessorService],
        exports: [assets_service_1.AssetsService, image_processor_service_1.ImageProcessorService, video_processor_service_1.VideoProcessorService],
    })
], AssetsModule);
//# sourceMappingURL=assets.module.js.map