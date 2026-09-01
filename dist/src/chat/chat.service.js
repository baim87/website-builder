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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_gateway_service_1 = require("../ai-gateway/ai-gateway.service");
const chat_stream_service_1 = require("./chat-stream.service");
let ChatService = class ChatService {
    prisma;
    aiGateway;
    streamService;
    constructor(prisma, aiGateway, streamService) {
        this.prisma = prisma;
        this.aiGateway = aiGateway;
        this.streamService = streamService;
    }
    async *sendMessage(projectId, content, systemPrompt, model = 'claude-haiku-4-5-20251001') {
        const textContent = Array.isArray(content)
            ? content.find(c => c.type === 'text')?.text || ''
            : content;
        await this.prisma.chatMessage.create({
            data: {
                projectId,
                role: 'user',
                content: textContent,
            },
        });
        const history = await this.prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
            take: 20,
        });
        const messages = history.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }));
        if (messages.length > 0 && Array.isArray(content)) {
            messages[messages.length - 1].content = content;
        }
        const stream = this.aiGateway.generateStream(model, {
            systemPrompt,
            messages,
        });
        let fullResponse = '';
        try {
            for await (const chunk of stream) {
                const text = chunk.text || '';
                fullResponse += text;
                yield this.streamService.formatTokenEvent(text);
            }
        }
        catch (e) {
            yield this.streamService.formatErrorEvent(e.message);
            return;
        }
        await this.prisma.chatMessage.create({
            data: {
                projectId,
                role: 'assistant',
                content: fullResponse,
            },
        });
        yield { event: 'internal-done', data: { fullResponse } };
    }
    async getHistory(projectId, page, limit) {
        const skip = (page - 1) * limit;
        return this.prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
            skip,
            take: limit,
        });
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_gateway_service_1.AIGatewayService,
        chat_stream_service_1.ChatStreamService])
], ChatService);
//# sourceMappingURL=chat.service.js.map