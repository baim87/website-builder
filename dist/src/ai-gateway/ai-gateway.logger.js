"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AIGatewayLogger_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIGatewayLogger = void 0;
const common_1 = require("@nestjs/common");
let AIGatewayLogger = AIGatewayLogger_1 = class AIGatewayLogger {
    logger = new common_1.Logger(AIGatewayLogger_1.name);
    logCall(model, latencyMs, usage) {
        this.logger.log(`[Model: ${model}] | Latency: ${latencyMs}ms | Tokens: (In: ${usage.promptTokens}, Out: ${usage.completionTokens})`);
    }
    logError(model, error) {
        this.logger.error(`[Model: ${model}] Error: ${error.message}`, error.stack);
    }
};
exports.AIGatewayLogger = AIGatewayLogger;
exports.AIGatewayLogger = AIGatewayLogger = AIGatewayLogger_1 = __decorate([
    (0, common_1.Injectable)()
], AIGatewayLogger);
//# sourceMappingURL=ai-gateway.logger.js.map