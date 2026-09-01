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
exports.BillingGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
let BillingGuard = class BillingGuard {
    configService;
    prisma;
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const bypassBilling = this.configService.get('BYPASS_BILLING');
        if (bypassBilling) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id;
        if (!userId) {
            throw new common_1.ForbiddenException('User not authenticated');
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
            throw new common_1.ForbiddenException('Active billing subscription required');
        }
        if (new Date() > new Date(subscription.currentPeriodEnd)) {
            throw new common_1.ForbiddenException('Billing subscription has expired');
        }
        return true;
    }
};
exports.BillingGuard = BillingGuard;
exports.BillingGuard = BillingGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], BillingGuard);
//# sourceMappingURL=billing.guard.js.map