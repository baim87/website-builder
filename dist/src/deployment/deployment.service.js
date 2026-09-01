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
var DeploymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const vercel_client_1 = require("../vercel/vercel.client");
let DeploymentService = DeploymentService_1 = class DeploymentService {
    prisma;
    vercelClient;
    logger = new common_1.Logger(DeploymentService_1.name);
    constructor(prisma, vercelClient) {
        this.prisma = prisma;
        this.vercelClient = vercelClient;
    }
    async deployProject(projectId, userId) {
        this.logger.log(`Deploying project ${projectId} for user ${userId}`);
        const project = await this.prisma.project.findUnique({
            where: { id: projectId, userId },
            include: { domain: true },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const primaryDomain = project.domain?.domainName
            || `${project.id}.yourplatform.com`;
        await this.vercelClient.addDomain(primaryDomain);
        const updatedProject = await this.prisma.project.update({
            where: { id: projectId },
            data: { status: 'PUBLISHED' },
        });
        await this.vercelClient.revalidate('/', primaryDomain);
        return {
            success: true,
            deploymentId: 'live-multi-tenant',
            status: 'READY',
            url: `https://${primaryDomain}`,
            project: updatedProject,
        };
    }
    async getDeploymentStatus(projectId, userId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId, userId },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        return {
            projectId,
            status: project.status,
            ready: project.status === 'PUBLISHED',
        };
    }
    async revalidateProject(projectId, userId, path = '/') {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId, userId },
            include: { domain: true },
        });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const primaryDomain = project.domain?.domainName
            || `${project.id}.yourplatform.com`;
        const result = await this.vercelClient.revalidate(path, primaryDomain);
        return {
            success: true,
            path,
            domain: primaryDomain,
            result,
        };
    }
};
exports.DeploymentService = DeploymentService;
exports.DeploymentService = DeploymentService = DeploymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        vercel_client_1.VercelClient])
], DeploymentService);
//# sourceMappingURL=deployment.service.js.map