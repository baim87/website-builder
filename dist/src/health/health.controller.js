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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const storage_service_1 = require("../storage/storage.service");
const public_decorator_1 = require("../common/decorators/public.decorator");
let HealthController = class HealthController {
    prisma;
    configService;
    storage;
    constructor(prisma, configService, storage) {
        this.prisma = prisma;
        this.configService = configService;
        this.storage = storage;
    }
    async check() {
        const status = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {},
        };
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            status.services.database = 'ok';
        }
        catch (e) {
            status.services.database = 'error';
            status.status = 'error';
        }
        try {
            const redis = new ioredis_1.default(this.configService.get('REDIS_URL'));
            await redis.ping();
            redis.disconnect();
            status.services.redis = 'ok';
        }
        catch (e) {
            status.services.redis = 'error';
            status.status = 'error';
        }
        try {
            if (this.storage) {
                status.services.storage = 'ok';
            }
        }
        catch (e) {
            status.services.storage = 'error';
            status.status = 'error';
        }
        return status;
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        storage_service_1.StorageService])
], HealthController);
//# sourceMappingURL=health.controller.js.map