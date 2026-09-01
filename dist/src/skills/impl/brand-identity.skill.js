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
var BrandIdentitySkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandIdentitySkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const crypto = __importStar(require("crypto"));
let BrandIdentitySkill = BrandIdentitySkill_1 = class BrandIdentitySkill {
    aiGateway;
    validator;
    name = 'brand_identity';
    logger = new common_1.Logger(BrandIdentitySkill_1.name);
    constructor(aiGateway, validator) {
        this.aiGateway = aiGateway;
        this.validator = validator;
    }
    async execute(input) {
        const prompt = `You are a Brand Identity expert for home service contractors.

Given this business context, generate a brand identity as a JSON object.

Business Context:
${JSON.stringify(input.context, null, 2)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "colors": {
    "primary": "#hexvalue",
    "secondary": "#hexvalue",
    "accent": "#hexvalue"
  },
  "typography": {
    "headingFont": "Font Family Name",
    "bodyFont": "Font Family Name"
  }
}`;
        const result = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [
                { role: 'user', content: prompt }
            ],
            maxTokens: 1500,
            temperature: 0.3,
            responseFormat: 'json',
        });
        this.logger.debug(`Raw LLM output: ${result.text}`);
        let parsed;
        try {
            let raw = result.text.trim();
            const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (fenceMatch)
                raw = fenceMatch[1].trim();
            if (!raw.startsWith('{')) {
                const start = raw.indexOf('{');
                const end = raw.lastIndexOf('}');
                if (start !== -1 && end > start)
                    raw = raw.substring(start, end + 1);
            }
            parsed = JSON.parse(raw);
        }
        catch {
            this.logger.error(`Failed to parse LLM output as JSON: ${result.text}`);
            throw new Error(`BrandIdentity LLM returned unparseable output: ${result.text.substring(0, 200)}`);
        }
        if (!parsed.colors && (parsed.primary || parsed.primaryColor || parsed.primary_color)) {
            this.logger.warn('LLM returned flat color structure, normalizing...');
            parsed = {
                colors: {
                    primary: parsed.primary || parsed.primaryColor || parsed.primary_color || '#2E8BC0',
                    secondary: parsed.secondary || parsed.secondaryColor || parsed.secondary_color || '#FFFFFF',
                    accent: parsed.accent || parsed.accentColor || parsed.accent_color || '#333333',
                },
                typography: {
                    headingFont: parsed.headingFont || parsed.heading_font || parsed.typography?.headingFont || 'Montserrat',
                    bodyFont: parsed.bodyFont || parsed.body_font || parsed.typography?.bodyFont || 'Open Sans',
                },
            };
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.BrandIdentitySchema);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.BrandIdentitySkill = BrandIdentitySkill;
exports.BrandIdentitySkill = BrandIdentitySkill = BrandIdentitySkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService])
], BrandIdentitySkill);
//# sourceMappingURL=brand-identity.skill.js.map