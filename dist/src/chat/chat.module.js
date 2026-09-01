"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const chat_controller_1 = require("./chat.controller");
const chat_stream_service_1 = require("./chat-stream.service");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_gateway_module_1 = require("../ai-gateway/ai-gateway.module");
const interview_module_1 = require("../interview/interview.module");
const common_2 = require("@nestjs/common");
const edit_intent_service_1 = require("./edit-intent.service");
const edit_executor_service_1 = require("./edit-executor.service");
const queue_module_1 = require("../queue/queue.module");
const projects_module_1 = require("../projects/projects.module");
const guardrails_module_1 = require("../guardrails/guardrails.module");
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_gateway_module_1.AIGatewayModule, (0, common_2.forwardRef)(() => interview_module_1.InterviewModule), queue_module_1.QueueModule, projects_module_1.ProjectsModule, guardrails_module_1.GuardrailsModule],
        controllers: [chat_controller_1.ChatController],
        providers: [chat_service_1.ChatService, chat_stream_service_1.ChatStreamService, edit_intent_service_1.EditIntentService, edit_executor_service_1.EditExecutorService],
        exports: [chat_service_1.ChatService, chat_stream_service_1.ChatStreamService, edit_intent_service_1.EditIntentService, edit_executor_service_1.EditExecutorService],
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map