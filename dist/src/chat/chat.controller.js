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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const chat_service_1 = require("./chat.service");
const send_message_dto_1 = require("./dto/send-message.dto");
const chat_history_dto_1 = require("./dto/chat-history.dto");
const zod_validation_pipe_1 = require("../common/pipes/zod-validation.pipe");
const rxjs_1 = require("rxjs");
const interview_service_1 = require("../interview/interview.service");
let ChatController = class ChatController {
    chatService;
    interviewService;
    constructor(chatService, interviewService) {
        this.chatService = chatService;
        this.interviewService = interviewService;
    }
    sendMessage(projectId, dto) {
        return new rxjs_1.Observable((subscriber) => {
            (async () => {
                try {
                    const status = await this.interviewService.checkCompleteness(projectId);
                    const stream = this.interviewService.processMessage(projectId, dto.content, status.missingFields);
                    for await (const event of stream) {
                        if (event.event === 'internal-done') {
                            subscriber.next({ type: 'done', data: {} });
                            break;
                        }
                        else {
                            subscriber.next({ type: event.event, data: event.data });
                        }
                    }
                    subscriber.complete();
                }
                catch (err) {
                    subscriber.error(err);
                }
            })();
        });
    }
    getHistory(projectId, query) {
        return this.chatService.getHistory(projectId, query.page, query.limit);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)(':projectId/message'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(send_message_dto_1.SendMessageSchema)),
    (0, common_1.Sse)(),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)(':projectId/history'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)(new zod_validation_pipe_1.ZodValidationPipe(chat_history_dto_1.ChatHistorySchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "getHistory", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        interview_service_1.InterviewService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map