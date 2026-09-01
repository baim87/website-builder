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
var DomainService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const vercel_client_1 = require("../vercel/vercel.client");
let DomainService = DomainService_1 = class DomainService {
    prisma;
    vercelClient;
    logger = new common_1.Logger(DomainService_1.name);
    constructor(prisma, vercelClient) {
        this.prisma = prisma;
        this.vercelClient = vercelClient;
    }
    async searchDomain(query) {
        this.logger.log(`Searching domain: ${query}`);
        const result = await this.vercelClient.checkDomainPrice(query);
        return {
            domainName: query,
            available: result.available || false,
            price: result.price,
            period: result.period,
        };
    }
    async purchaseDomain(projectId, userId, domainName, expectedPrice) {
        this.logger.log(`Purchasing domain ${domainName} for project ${projectId} (User: ${userId})`);
        const project = await this.prisma.project.findUnique({
            where: { id: projectId, userId },
            include: { domain: true },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        if (project.domain) {
            throw new common_1.BadRequestException('Project already has a primary domain. Please remove it first to buy a new one.');
        }
        const check = await this.vercelClient.checkDomainPrice(domainName);
        if (!check.available) {
            throw new common_1.BadRequestException('Domain is no longer available');
        }
        if (check.price !== expectedPrice) {
            throw new common_1.BadRequestException(`Price mismatch. Expected ${expectedPrice}, got ${check.price}`);
        }
        const purchaseResult = await this.vercelClient.buyDomain(domainName, expectedPrice);
        await this.vercelClient.addDomain(domainName);
        const domainRecord = await this.prisma.domain.create({
            data: {
                projectId,
                domainName,
                provider: 'VERCEL',
                status: 'ACTIVE',
            },
        });
        return {
            success: true,
            domain: domainRecord,
            mocked: purchaseResult.mocked || false,
        };
    }
};
exports.DomainService = DomainService;
exports.DomainService = DomainService = DomainService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        vercel_client_1.VercelClient])
], DomainService);
//# sourceMappingURL=domain.service.js.map