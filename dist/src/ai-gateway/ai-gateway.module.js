"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIGatewayModule = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("./ai-gateway.service");
const claude_fable_adapter_1 = require("./adapters/claude-fable.adapter");
const model_registry_1 = require("./config/model-registry");
const ai_gateway_logger_1 = require("./ai-gateway.logger");
let AIGatewayModule = class AIGatewayModule {
};
exports.AIGatewayModule = AIGatewayModule;
exports.AIGatewayModule = AIGatewayModule = __decorate([
    (0, common_1.Module)({
        providers: [
            ai_gateway_service_1.AIGatewayService,
            claude_fable_adapter_1.ClaudeFableAdapter,
            model_registry_1.ModelRegistry,
            ai_gateway_logger_1.AIGatewayLogger,
        ],
        exports: [ai_gateway_service_1.AIGatewayService],
    })
], AIGatewayModule);
//# sourceMappingURL=ai-gateway.module.js.map