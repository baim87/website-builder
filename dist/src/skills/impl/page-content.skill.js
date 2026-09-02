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
var PageContentSkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageContentSkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const crypto = __importStar(require("crypto"));
let PageContentSkill = PageContentSkill_1 = class PageContentSkill {
    aiGateway;
    validator;
    name = 'PageContent';
    logger = new common_1.Logger(PageContentSkill_1.name);
    constructor(aiGateway, validator) {
        this.aiGateway = aiGateway;
        this.validator = validator;
    }
    async execute(input) {
        const pageSlug = input.context.pageSlug || 'home';
        const prompt = `Generate content for the ${pageSlug} page of this contractor business.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "slug": "${pageSlug}",
  "sections": [
    {
      "id": "unique-section-id",
      "type": "HeroSection", // MUST be one of the supported types below
      "content": { ... } // Must match the data structure expected by the section
    }
  ]
}

SUPPORTED SECTION TYPES (You can ONLY use these types):
- HeroSection: { "headline": string, "subheadline": string, "ctaText": string, "backgroundImage": string }
- ServicesSection: { "items": Array<{ slug: string, name: string, description: string, icon: string, image: string }> }
- AboutSection: { "story": string, "mission": string, "values": Array<{title: string, description: string}>, "team": Array<{name: string, role: string, photo: string}> }
- BrandsSection: Array<{ name: string, icon: string }>
- WhyUsSection: Array<{ title: string, description: string, icon: string }>
- TestimonialsSection: Array<{ name: string, text: string, rating: number, role?: string, avatar?: string }>
- BeforeAfterSection: Array<{ title: string, description: string, beforeImage: string, afterImage: string }>
- TimelineSection: Array<{ step: number, title: string, description: string }>
- LocationsSection: { "items": Array<{ slug: string, name: string, description: string, image: string }> }

Do not invent new section types. Use the supported ones to compose the page.`;
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            maxTokens: 8192,
            responseFormat: 'json',
        });
        this.logger.debug(`[${pageSlug}] Raw LLM output: ${response.text}`);
        let parsed;
        try {
            let raw = response.text.trim();
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
            this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
            throw new Error(`PageContent LLM returned unparseable output: ${response.text.substring(0, 200)}`);
        }
        if (!parsed.slug && parsed.pageContent) {
            parsed = parsed.pageContent;
        }
        if (!parsed.slug && parsed.page_content) {
            parsed = parsed.page_content;
        }
        if (parsed && !parsed.slug) {
            parsed.slug = pageSlug;
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.PageContentSchema);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.PageContentSkill = PageContentSkill;
exports.PageContentSkill = PageContentSkill = PageContentSkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService])
], PageContentSkill);
//# sourceMappingURL=page-content.skill.js.map