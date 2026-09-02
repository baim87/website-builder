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
var BusinessContextService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessContextService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const location_metrics_service_1 = require("../seo/location-metrics.service");
let BusinessContextService = BusinessContextService_1 = class BusinessContextService {
    prisma;
    locationMetrics;
    logger = new common_1.Logger(BusinessContextService_1.name);
    constructor(prisma, locationMetrics) {
        this.prisma = prisma;
        this.locationMetrics = locationMetrics;
    }
    async findByProjectId(projectId, userId) {
        if (userId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId, userId },
            });
            if (!project)
                throw new common_1.NotFoundException(`Project ${projectId} not found or access denied`);
        }
        const context = await this.prisma.businessContext.findUnique({
            where: { projectId },
        });
        if (!context) {
            throw new common_1.NotFoundException(`Business context for project ${projectId} not found`);
        }
        const brandInputs = context.brandIdentityInputs || {};
        return {
            ...context,
            primaryColor: brandInputs.primaryColor,
            secondaryColor: brandInputs.secondaryColor,
            fontStyle: brandInputs.fontStyle,
        };
    }
    async upsert(projectId, data, userId) {
        if (userId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId, userId },
            });
            if (!project)
                throw new common_1.NotFoundException(`Project ${projectId} not found or access denied`);
        }
        const { primaryColor, secondaryColor, fontStyle, ...rest } = data;
        const hasNewBrand = primaryColor !== undefined || secondaryColor !== undefined || fontStyle !== undefined;
        let newBrandIdentityInputs = undefined;
        if (hasNewBrand) {
            const existing = await this.prisma.businessContext.findUnique({ where: { projectId } });
            const existingBrand = existing?.brandIdentityInputs || {};
            newBrandIdentityInputs = {
                ...existingBrand,
                ...(primaryColor !== undefined && { primaryColor }),
                ...(secondaryColor !== undefined && { secondaryColor }),
                ...(fontStyle !== undefined && { fontStyle }),
            };
        }
        if (rest.radius !== undefined) {
            if (typeof rest.radius === 'string') {
                const parsed = parseInt(String(rest.radius).replace(/[^0-9]/g, ''), 10);
                rest.radius = isNaN(parsed) ? 50 : parsed;
            }
        }
        const finalContext = await this.prisma.businessContext.upsert({
            where: { projectId },
            update: {
                ...rest,
                ...(hasNewBrand && { brandIdentityInputs: newBrandIdentityInputs }),
            },
            create: {
                projectId,
                ...rest,
                ...(hasNewBrand && { brandIdentityInputs: newBrandIdentityInputs }),
            },
        });
        if (finalContext.location && finalContext.services) {
            const servicesArray = Array.isArray(finalContext.services) ? finalContext.services : [];
            if (servicesArray.length > 0) {
                this.locationMetrics.processProjectMetrics(projectId, finalContext.location, finalContext.radius || 50, servicesArray).catch(e => {
                    this.logger.error(`Failed to process background location metrics for project ${projectId}`, e.stack);
                });
            }
        }
        return finalContext;
    }
};
exports.BusinessContextService = BusinessContextService;
exports.BusinessContextService = BusinessContextService = BusinessContextService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        location_metrics_service_1.LocationMetricsService])
], BusinessContextService);
//# sourceMappingURL=business-context.service.js.map