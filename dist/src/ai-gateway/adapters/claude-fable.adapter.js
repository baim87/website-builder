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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeFableAdapter = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ClaudeFableAdapter = class ClaudeFableAdapter {
    configService;
    client;
    constructor(configService) {
        this.configService = configService;
        this.client = new sdk_1.default({
            apiKey: this.configService.get('ANTHROPIC_API_KEY'),
        });
    }
    async executeWithRetry(operation, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                if (attempt < maxRetries &&
                    (error?.status === 429 || error?.status === 529 || error?.message?.includes('Overloaded'))) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    console.warn(`[Claude Adapter] API Overloaded or Rate Limited. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Unreachable');
    }
    async *generateStream(model, params) {
        const stream = await this.executeWithRetry(() => this.client.messages.create({
            model,
            system: params.systemPrompt,
            messages: this.mapMessages(params.messages),
            max_tokens: params.maxTokens || 4096,
            stream: true,
        }, {
            headers: params.maxTokens && params.maxTokens > 4096 ? { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' } : undefined
        }));
        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                yield { text: chunk.delta.text };
            }
        }
    }
    async generateText(model, params) {
        const response = await this.executeWithRetry(() => this.client.messages.create({
            model,
            system: params.systemPrompt,
            messages: this.mapMessages(params.messages),
            max_tokens: params.maxTokens || 4096,
        }, {
            headers: params.maxTokens && params.maxTokens > 4096 ? { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' } : undefined
        }));
        let text = '';
        for (const block of response.content) {
            if (block.type === 'text') {
                text += block.text;
            }
            else {
                console.warn('[Claude Adapter] Ignoring non-text block:', block.type);
            }
        }
        return {
            text,
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
            },
        };
    }
    mapMessages(messages) {
        return messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
            role: m.role,
            content: m.content,
        }));
    }
};
exports.ClaudeFableAdapter = ClaudeFableAdapter;
exports.ClaudeFableAdapter = ClaudeFableAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ClaudeFableAdapter);
//# sourceMappingURL=claude-fable.adapter.js.map