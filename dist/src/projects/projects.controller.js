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
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const projects_service_1 = require("./projects.service");
const business_context_service_1 = require("./business-context.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const create_project_dto_1 = require("./dto/create-project.dto");
const update_business_context_dto_1 = require("./dto/update-business-context.dto");
const zod_validation_pipe_1 = require("../common/pipes/zod-validation.pipe");
const generation_producer_1 = require("../queue/producers/generation.producer");
let ProjectsController = class ProjectsController {
    projectsService;
    businessContextService;
    generationProducer;
    constructor(projectsService, businessContextService, generationProducer) {
        this.projectsService = projectsService;
        this.businessContextService = businessContextService;
        this.generationProducer = generationProducer;
    }
    create(userId, createProjectDto) {
        return this.projectsService.create(userId, createProjectDto);
    }
    findAll(userId) {
        return this.projectsService.findAll(userId);
    }
    findOne(id, userId) {
        return this.projectsService.findOne(id, userId);
    }
    remove(id, userId) {
        return this.projectsService.delete(id, userId);
    }
    getBusinessContext(id, userId) {
        return this.businessContextService.findByProjectId(id, userId);
    }
    updateBusinessContext(id, userId, updateDto) {
        return this.businessContextService.upsert(id, updateDto, userId);
    }
    async triggerGeneration(id, userId) {
        await this.projectsService.findOne(id, userId);
        await this.generationProducer.generateSite(id);
        return { message: 'Generation queued successfully' };
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(create_project_dto_1.CreateProjectSchema)),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/business-context'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getBusinessContext", null);
__decorate([
    (0, common_1.Patch)(':id/business-context'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(update_business_context_dto_1.UpdateBusinessContextSchema)),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "updateBusinessContext", null);
__decorate([
    (0, common_1.Post)(':id/generate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "triggerGeneration", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService,
        business_context_service_1.BusinessContextService,
        generation_producer_1.GenerationProducer])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map