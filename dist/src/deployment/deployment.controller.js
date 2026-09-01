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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentController = void 0;
const common_1 = require("@nestjs/common");
const deployment_service_1 = require("./deployment.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let DeploymentController = class DeploymentController {
    deploymentService;
    constructor(deploymentService) {
        this.deploymentService = deploymentService;
    }
    async deploy(projectId, req) {
        return this.deploymentService.deployProject(projectId, req.user.id);
    }
    async getStatus(projectId, req) {
        return this.deploymentService.getDeploymentStatus(projectId, req.user.id);
    }
    async revalidate(projectId, path, req) {
        return this.deploymentService.revalidateProject(projectId, req.user.id, path || '/');
    }
};
exports.DeploymentController = DeploymentController;
__decorate([
    (0, common_1.Post)('deploy'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeploymentController.prototype, "deploy", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeploymentController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('revalidate'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)('path')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], DeploymentController.prototype, "revalidate", null);
exports.DeploymentController = DeploymentController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('projects/:projectId/deployment'),
    __metadata("design:paramtypes", [deployment_service_1.DeploymentService])
], DeploymentController);
//# sourceMappingURL=deployment.controller.js.map