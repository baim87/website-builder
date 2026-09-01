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
exports.AIGatewayService = void 0;
const common_1 = require("@nestjs/common");
const model_registry_1 = require("./config/model-registry");
const ai_gateway_logger_1 = require("./ai-gateway.logger");
let AIGatewayService = class AIGatewayService {
    registry;
    logger;
    constructor(registry, logger) {
        this.registry = registry;
        this.logger = logger;
    }
    async generateText(model, params) {
        const adapter = this.registry.getAdapter(model);
        const start = Date.now();
        try {
            const result = await adapter.generateText(model, params);
            const latency = Date.now() - start;
            this.logger.logCall(model, latency, result.usage);
            return result;
        }
        catch (e) {
            this.logger.logError(model, e);
            throw e;
        }
    }
    async *generateStream(model, params) {
        const adapter = this.registry.getAdapter(model);
        const start = Date.now();
        try {
            const stream = adapter.generateStream(model, params);
            for await (const chunk of stream) {
                yield chunk;
            }
            const latency = Date.now() - start;
            this.logger.logCall(model, latency, { promptTokens: 0, completionTokens: 0 });
        }
        catch (e) {
            this.logger.logError(model, e);
            throw e;
        }
    }
};
exports.AIGatewayService = AIGatewayService;
exports.AIGatewayService = AIGatewayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_registry_1.ModelRegistry,
        ai_gateway_logger_1.AIGatewayLogger])
], AIGatewayService);
//# sourceMappingURL=ai-gateway.service.js.map