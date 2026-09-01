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
var EditIntentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditIntentService = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../ai-gateway/ai-gateway.service");
const edit_executor_service_1 = require("./edit-executor.service");
const output_validator_service_1 = require("../guardrails/output-validator.service");
const zod_1 = require("zod");
const EditIntentSchema = zod_1.z.object({
    isEdit: zod_1.z.boolean(),
    changes: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        value: zod_1.z.any(),
    })).optional(),
    triggerRegeneration: zod_1.z.boolean().optional(),
});
let EditIntentService = EditIntentService_1 = class EditIntentService {
    aiGateway;
    editExecutor;
    validator;
    logger = new common_1.Logger(EditIntentService_1.name);
    constructor(aiGateway, editExecutor, validator) {
        this.aiGateway = aiGateway;
        this.editExecutor = editExecutor;
        this.validator = validator;
    }
    async detectAndApplyEdit(projectId, userMessage, currentWebsiteData) {
        const prompt = `You are a strict JSON-only intent detector for a website builder.
The user sent this message: "${userMessage}"
Current website data snippet: ${JSON.stringify(currentWebsiteData).substring(0, 1000)}...

If the user is asking to change the website (e.g. change color, update text, add a section), return JSON:
{
  "isEdit": true,
  "changes": [
    {
      "path": "designTokens.colors.primary",
      "value": "#ff0000"
    }
  ],
  "triggerRegeneration": true
}

If it's just a general question or unrelated, return {"isEdit": false}

Output ONLY valid JSON matching the schema.`;
        try {
            const response = await this.aiGateway.generateText('claude-fable', {
                systemPrompt: 'You extract edit intents in JSON format.',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                responseFormat: 'json',
            });
            const intent = this.validator.validate(response.text, EditIntentSchema);
            if (intent.isEdit && intent.changes && intent.changes.length > 0) {
                this.logger.log(`Detected edit intent for project ${projectId}`, intent.changes);
                await this.editExecutor.applyEdits(projectId, intent, currentWebsiteData);
                return true;
            }
        }
        catch (e) {
            this.logger.error(`Failed to detect edit intent for project ${projectId}`, e.stack);
        }
        return false;
    }
};
exports.EditIntentService = EditIntentService;
exports.EditIntentService = EditIntentService = EditIntentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        edit_executor_service_1.EditExecutorService,
        output_validator_service_1.OutputValidatorService])
], EditIntentService);
//# sourceMappingURL=edit-intent.service.js.map