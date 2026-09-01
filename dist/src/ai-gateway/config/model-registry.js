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
exports.ModelRegistry = void 0;
const common_1 = require("@nestjs/common");
const claude_fable_adapter_1 = require("../adapters/claude-fable.adapter");
let ModelRegistry = class ModelRegistry {
    claudeAdapter;
    registry = new Map();
    constructor(claudeAdapter) {
        this.claudeAdapter = claudeAdapter;
        this.registry.set('claude-fable-5', this.claudeAdapter);
        this.registry.set('claude-haiku-4-5-20251001', this.claudeAdapter);
    }
    getAdapter(modelId) {
        const adapter = this.registry.get(modelId);
        if (!adapter) {
            throw new Error(`Unsupported model ID: ${modelId}`);
        }
        return adapter;
    }
};
exports.ModelRegistry = ModelRegistry;
exports.ModelRegistry = ModelRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [claude_fable_adapter_1.ClaudeFableAdapter])
], ModelRegistry);
//# sourceMappingURL=model-registry.js.map