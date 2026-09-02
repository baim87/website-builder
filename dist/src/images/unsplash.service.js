"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var UnsplashService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsplashService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let UnsplashService = UnsplashService_1 = class UnsplashService {
    logger = new common_1.Logger(UnsplashService_1.name);
    accessKey = process.env.UNSPLASH_ACCESS_KEY;
    async searchImage(query) {
        if (!this.accessKey) {
            this.logger.warn('UNSPLASH_ACCESS_KEY is missing. Returning placeholder.');
            return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
        }
        try {
            this.logger.debug(`Fetching image for query: "${query}"`);
            const response = await axios_1.default.get('https://api.unsplash.com/search/photos', {
                params: {
                    query,
                    per_page: 1,
                    orientation: 'landscape'
                },
                headers: {
                    Authorization: `Client-ID ${this.accessKey}`
                }
            });
            const results = response.data.results;
            if (results && results.length > 0) {
                return results[0].urls.regular;
            }
            this.logger.warn(`No images found for query: "${query}". Using fallback.`);
            return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
        }
        catch (error) {
            this.logger.error(`Failed to fetch image from Unsplash for query "${query}": ${error.message}`);
            return `https://loremflickr.com/1600/900/${encodeURIComponent(query)}`;
        }
    }
};
exports.UnsplashService = UnsplashService;
exports.UnsplashService = UnsplashService = UnsplashService_1 = __decorate([
    (0, common_1.Injectable)()
], UnsplashService);
//# sourceMappingURL=unsplash.service.js.map