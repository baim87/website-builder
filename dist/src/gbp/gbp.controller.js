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
exports.GbpController = void 0;
const common_1 = require("@nestjs/common");
const gbp_service_1 = require("./gbp.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../common/pipes/zod-validation.pipe");
const LookupSchema = zod_1.z.object({
    businessName: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
});
let GbpController = class GbpController {
    gbpService;
    constructor(gbpService) {
        this.gbpService = gbpService;
    }
    async lookup(query) {
        const data = await this.gbpService.lookup(query.businessName, query.location);
        return { data };
    }
};
exports.GbpController = GbpController;
__decorate([
    (0, common_1.Get)('lookup'),
    __param(0, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(LookupSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GbpController.prototype, "lookup", null);
exports.GbpController = GbpController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('gbp'),
    __metadata("design:paramtypes", [gbp_service_1.GbpService])
], GbpController);
//# sourceMappingURL=gbp.controller.js.map