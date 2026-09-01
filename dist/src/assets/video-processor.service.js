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
var VideoProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoProcessorService = void 0;
const common_1 = require("@nestjs/common");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = __importStar(require("@ffmpeg-installer/ffmpeg"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
let VideoProcessorService = VideoProcessorService_1 = class VideoProcessorService {
    logger = new common_1.Logger(VideoProcessorService_1.name);
    async convertToWebm(buffer) {
        const tempId = (0, uuid_1.v4)();
        const inputPath = path.join(os.tmpdir(), `${tempId}-input.tmp`);
        const outputPath = path.join(os.tmpdir(), `${tempId}-output.webm`);
        try {
            await fs.writeFile(inputPath, buffer);
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .output(outputPath)
                    .videoCodec('libvpx-vp9')
                    .audioCodec('libopus')
                    .outputOptions([
                    '-crf 30',
                    '-b:v 0',
                    '-deadline realtime',
                    '-cpu-used 4'
                ])
                    .on('end', () => {
                    this.logger.log(`Successfully converted video to WebM: ${outputPath}`);
                    resolve();
                })
                    .on('error', (err) => {
                    this.logger.error(`Error converting video to WebM`, err);
                    reject(err);
                })
                    .run();
            });
            const webmBuffer = await fs.readFile(outputPath);
            return webmBuffer;
        }
        catch (e) {
            this.logger.error('Failed to process video', e.stack);
            throw e;
        }
        finally {
            await fs.unlink(inputPath).catch(() => { });
            await fs.unlink(outputPath).catch(() => { });
        }
    }
};
exports.VideoProcessorService = VideoProcessorService;
exports.VideoProcessorService = VideoProcessorService = VideoProcessorService_1 = __decorate([
    (0, common_1.Injectable)()
], VideoProcessorService);
//# sourceMappingURL=video-processor.service.js.map