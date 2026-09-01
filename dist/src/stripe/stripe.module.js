"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeModule = exports.STRIPE_CLIENT = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stripe_1 = __importDefault(require("stripe"));
exports.STRIPE_CLIENT = 'STRIPE_CLIENT';
let StripeModule = class StripeModule {
};
exports.StripeModule = StripeModule;
exports.StripeModule = StripeModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.STRIPE_CLIENT,
                useFactory: (configService) => {
                    const secretKey = configService.get('STRIPE_SECRET_KEY');
                    if (!secretKey) {
                        return null;
                    }
                    return new stripe_1.default(secretKey, {
                        apiVersion: '2026-08-26.dahlia',
                    });
                },
                inject: [config_1.ConfigService],
            },
        ],
        exports: [exports.STRIPE_CLIENT],
    })
], StripeModule);
//# sourceMappingURL=stripe.module.js.map