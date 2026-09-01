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
exports.PublicSiteController = void 0;
const common_1 = require("@nestjs/common");
const site_content_service_1 = require("./site-content.service");
let PublicSiteController = class PublicSiteController {
    siteContentService;
    constructor(siteContentService) {
        this.siteContentService = siteContentService;
    }
    async getSiteContent(projectId) {
        try {
            const content = await this.siteContentService.getSiteContent(projectId);
            if (!content) {
                throw new common_1.NotFoundException(`Site content not found for project ${projectId}`);
            }
            return content;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            throw new common_1.NotFoundException(`Could not load site content for project ${projectId}`);
        }
    }
};
exports.PublicSiteController = PublicSiteController;
__decorate([
    (0, common_1.Get)(':projectId'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicSiteController.prototype, "getSiteContent", null);
exports.PublicSiteController = PublicSiteController = __decorate([
    (0, common_1.Controller)('public/site-content'),
    __metadata("design:paramtypes", [site_content_service_1.SiteContentService])
], PublicSiteController);
//# sourceMappingURL=public-site.controller.js.map