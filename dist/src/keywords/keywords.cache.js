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
var KeywordsCache_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordsCache = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let KeywordsCache = KeywordsCache_1 = class KeywordsCache {
    configService;
    redis;
    logger = new common_1.Logger(KeywordsCache_1.name);
    TTL_SECONDS = 7 * 24 * 60 * 60;
    constructor(configService) {
        this.configService = configService;
        this.redis = new ioredis_1.Redis(this.configService.get('REDIS_URL'));
    }
    getKey(trade, location) {
        return `keywords:${trade.toLowerCase()}:${location.toLowerCase()}`;
    }
    async get(trade, location) {
        const key = this.getKey(trade, location);
        const data = await this.redis.get(key);
        if (data) {
            this.logger.log(`Cache hit for ${key}`);
            return JSON.parse(data);
        }
        return null;
    }
    async set(trade, location, results) {
        const key = this.getKey(trade, location);
        await this.redis.set(key, JSON.stringify(results), 'EX', this.TTL_SECONDS);
        this.logger.log(`Cached results for ${key}`);
    }
};
exports.KeywordsCache = KeywordsCache;
exports.KeywordsCache = KeywordsCache = KeywordsCache_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], KeywordsCache);
//# sourceMappingURL=keywords.cache.js.map