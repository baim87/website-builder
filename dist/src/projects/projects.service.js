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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProjectsService = class ProjectsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        return this.prisma.project.create({
            data: {
                userId,
                name: dto.name,
                businessContext: {
                    create: {
                        trade: dto.trade,
                    },
                },
            },
            include: {
                businessContext: true,
            },
        });
    }
    async findAll(userId) {
        return this.prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id, userId) {
        const whereClause = { id };
        if (userId) {
            whereClause.userId = userId;
        }
        const project = await this.prisma.project.findUnique({
            where: whereClause,
            include: {
                businessContext: true,
                websiteData: true,
                domain: true,
            },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Project ${id} not found`);
        }
        return project;
    }
    async delete(id, userId) {
        try {
            const whereClause = { id };
            if (userId) {
                whereClause.userId = userId;
            }
            await this.prisma.project.delete({
                where: whereClause,
            });
            return { success: true };
        }
        catch (e) {
            throw new common_1.NotFoundException(`Project ${id} not found or you don't have access`);
        }
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map