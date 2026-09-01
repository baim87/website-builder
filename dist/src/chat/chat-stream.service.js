"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStreamService = void 0;
const common_1 = require("@nestjs/common");
let ChatStreamService = class ChatStreamService {
    formatTokenEvent(text) {
        return { event: 'token', data: { token: text } };
    }
    formatDoneEvent() {
        return { event: 'done', data: {} };
    }
    formatErrorEvent(message) {
        return { event: 'error', data: { message } };
    }
    formatFieldUpdateEvent(field, value) {
        return { event: 'field-update', data: { field, value } };
    }
    formatSkillInvocationEvent(skillName, status) {
        return { event: 'skill-invocation', data: { skillName, status } };
    }
    formatInterviewProgressEvent(progress, missingFields) {
        return { event: 'interview-progress', data: { progress, missingFields } };
    }
};
exports.ChatStreamService = ChatStreamService;
exports.ChatStreamService = ChatStreamService = __decorate([
    (0, common_1.Injectable)()
], ChatStreamService);
//# sourceMappingURL=chat-stream.service.js.map