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
exports.WebsiteDataService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let WebsiteDataService = class WebsiteDataService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByProjectId(projectId, userId) {
        if (userId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId, userId },
            });
            if (!project)
                throw new common_1.NotFoundException(`Project ${projectId} not found or access denied`);
        }
        const data = await this.prisma.websiteData.findUnique({
            where: { projectId },
        });
        if (!data) {
            throw new common_1.NotFoundException(`Website data for project ${projectId} not found`);
        }
        return data;
    }
    async upsert(projectId, data, userId) {
        if (userId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId, userId },
            });
            if (!project)
                throw new common_1.NotFoundException(`Project ${projectId} not found or access denied`);
        }
        return this.prisma.websiteData.upsert({
            where: { projectId },
            update: {
                ...data,
            },
            create: {
                projectId,
                ...data,
            },
        });
    }
    async updateGenerationStatus(projectId, status, userId) {
        if (userId) {
            const project = await this.prisma.project.findUnique({
                where: { id: projectId, userId },
            });
            if (!project)
                throw new common_1.NotFoundException(`Project ${projectId} not found or access denied`);
        }
        return this.prisma.websiteData.upsert({
            where: { projectId },
            update: { generationStatus: status },
            create: { projectId, generationStatus: status },
        });
    }
};
exports.WebsiteDataService = WebsiteDataService;
exports.WebsiteDataService = WebsiteDataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WebsiteDataService);
//# sourceMappingURL=website-data.service.js.map