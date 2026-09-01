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
exports.KeywordsService = void 0;
const common_1 = require("@nestjs/common");
const keywords_cache_1 = require("./keywords.cache");
const google_ads_client_1 = require("./clients/google-ads.client");
let KeywordsService = class KeywordsService {
    cache;
    googleAdsClient;
    constructor(cache, googleAdsClient) {
        this.cache = cache;
        this.googleAdsClient = googleAdsClient;
    }
    async getKeywords(trade, location) {
        const cached = await this.cache.get(trade, location);
        if (cached) {
            return cached;
        }
        const results = await this.googleAdsClient.fetchKeywords(trade, location);
        await this.cache.set(trade, location, results);
        return results;
    }
};
exports.KeywordsService = KeywordsService;
exports.KeywordsService = KeywordsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [keywords_cache_1.KeywordsCache,
        google_ads_client_1.GoogleAdsClient])
], KeywordsService);
//# sourceMappingURL=keywords.service.js.map