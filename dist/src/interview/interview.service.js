"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewService = void 0;
const common_1 = require("@nestjs/common");
const interview_extractor_service_1 = require("./interview-extractor.service");
const interview_prompt_builder_1 = require("./interview-prompt.builder");
const business_context_service_1 = require("../projects/business-context.service");
const interview_fields_constant_1 = require("./constants/interview-fields.constant");
const chat_service_1 = require("../chat/chat.service");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
let InterviewService = class InterviewService {
    extractor;
    promptBuilder;
    businessContextService;
    chatService;
    prisma;
    constructor(extractor, promptBuilder, businessContextService, chatService, prisma) {
        this.extractor = extractor;
        this.promptBuilder = promptBuilder;
        this.businessContextService = businessContextService;
        this.chatService = chatService;
        this.prisma = prisma;
    }
    async checkCompleteness(projectId, fieldsToCheck = interview_fields_constant_1.REQUIRED_FIELDS) {
        const context = await this.businessContextService.findByProjectId(projectId);
        const missingFields = [];
        for (const field of fieldsToCheck) {
            const val = context[field];
            if (!val || (Array.isArray(val) && val.length === 0)) {
                missingFields.push(field);
            }
        }
        const total = fieldsToCheck.length;
        const completeCount = total - missingFields.length;
        return {
            complete: missingFields.length === 0,
            missingFields,
            progress: Math.round((completeCount / total) * 100),
        };
    }
    async *processMessage(projectId, content, missingFields) {
        const context = await this.businessContextService.findByProjectId(projectId);
        const systemPrompt = this.promptBuilder.buildPrompt(context, missingFields);
        const logoAsset = await this.prisma.asset.findFirst({
            where: { projectId, purpose: 'logo' },
            orderBy: { createdAt: 'desc' }
        });
        let finalContent = content;
        if (logoAsset && missingFields.includes('primaryColor')) {
            try {
                let base64 = '';
                let mimeType = logoAsset.mimeType || 'image/png';
                if (logoAsset.url.startsWith('http')) {
                    const res = await fetch(logoAsset.url);
                    const buffer = await res.arrayBuffer();
                    base64 = Buffer.from(buffer).toString('base64');
                    mimeType = res.headers.get('content-type') || mimeType;
                }
                else {
                    base64 = fs.readFileSync(logoAsset.url, 'base64');
                }
                finalContent = [
                    { type: 'text', text: content },
                    { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
                ];
            }
            catch (err) {
            }
        }
        const stream = this.chatService.sendMessage(projectId, finalContent, systemPrompt);
        for await (const event of stream) {
            if (event.event === 'internal-done') {
                const fullResponse = event.data.fullResponse;
                const { extractedFields } = this.extractor.extract(fullResponse);
                if (Object.keys(extractedFields).length > 0) {
                    await this.businessContextService.upsert(projectId, extractedFields);
                    for (const [field, value] of Object.entries(extractedFields)) {
                        yield { event: 'field-update', data: { field, value } };
                    }
                }
                yield { event: 'done', data: {} };
            }
            else {
                yield event;
            }
        }
    }
};
exports.InterviewService = InterviewService;
exports.InterviewService = InterviewService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [interview_extractor_service_1.InterviewExtractorService,
        interview_prompt_builder_1.InterviewPromptBuilder,
        business_context_service_1.BusinessContextService,
        chat_service_1.ChatService,
        prisma_service_1.PrismaService])
], InterviewService);
//# sourceMappingURL=interview.service.js.map