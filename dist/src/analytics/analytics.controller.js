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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const analytics_provisioning_producer_1 = require("../queue/producers/analytics-provisioning.producer");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    analyticsProducer;
    constructor(analyticsService, analyticsProducer) {
        this.analyticsService = analyticsService;
        this.analyticsProducer = analyticsProducer;
    }
    async getSummary(projectId, req) {
        return this.analyticsService.getAnalyticsSummary(projectId, req.user.id);
    }
    async provision(projectId, domainName) {
        if (!domainName) {
            throw new common_1.HttpException('Domain name is required to provision analytics', common_1.HttpStatus.BAD_REQUEST);
        }
        await this.analyticsProducer.provisionAnalytics(projectId, domainName);
        return { status: 'ACCEPTED', message: 'Analytics provisioning has been queued and will complete in the background.' };
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Post)('provision'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)('domainName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "provision", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('projects/:projectId/analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService,
        analytics_provisioning_producer_1.AnalyticsProvisioningProducer])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map