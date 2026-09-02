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
var SectionContentSkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionContentSkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const crypto = __importStar(require("crypto"));
let SectionContentSkill = SectionContentSkill_1 = class SectionContentSkill {
    aiGateway;
    validator;
    name = 'SectionContent';
    logger = new common_1.Logger(SectionContentSkill_1.name);
    constructor(aiGateway, validator) {
        this.aiGateway = aiGateway;
        this.validator = validator;
    }
    async execute(input) {
        const pageSlug = input.context.pageSlug || 'home';
        const sectionType = input.context.sectionType;
        if (!sectionType) {
            throw new Error('SectionContentSkill requires sectionType in context');
        }
        const prompt = `Generate content for a "${sectionType}" section on the "${pageSlug}" page.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object exactly matching this structure (no markdown fences, no explanation):
{
  "id": "unique-${sectionType.toLowerCase()}-${Math.random().toString(36).substring(7)}",
  "type": "${sectionType}",
  "content": <INSERT_OBJECT_OR_ARRAY_HERE>
}

- HeroSection: { headline: string, subheadline: string, ctaText: string, backgroundImage: string }
- PageHeaderSection: { title: string, description: string, badge: string, backgroundImage: string }
- BrandsSection: [ { name: string, icon: string } ]
- ServicesSection: { items: [ { slug: string, name: string, description: string, icon: string, image: string } ] }
- AboutSection: { story: string, mission: string, values: [{title: string, description: string}], team: [{name: string, role: string, photo: string}] }
- WhyUsSection: [ { title: string, description: string, icon: string } ]
- BeforeAfterSection: [ { title: string, beforeImage: string, afterImage: string, description: string } ]
- TimelineSection: [ { step: number, title: string, description: string } ]
- TestimonialsSection: [ { name: string, text: string, rating: number, avatar: string, role: string, projectImage: string } ]
- LocationsSection: { items: [ { slug: string, name: string, description: string, image: string } ] }
- ServiceDetailsSection: { overview: string, whyChooseUs: [string], process: [string], cta: { heading: string, subheading: string, buttonText: string } }
- CallToActionSection: { heading: string, subheading: string, buttonText: string, backgroundImage: string }
`;
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            maxTokens: 8192,
            responseFormat: 'json',
        });
        this.logger.debug(`[${pageSlug}] SectionContent (${sectionType}) raw output: ${response.text.substring(0, 100)}...`);
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
            throw new Error(`SectionContent LLM returned unparseable output`);
        }
        if (parsed) {
            parsed.type = sectionType;
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.SectionSchema);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.SectionContentSkill = SectionContentSkill;
exports.SectionContentSkill = SectionContentSkill = SectionContentSkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService])
], SectionContentSkill);
//# sourceMappingURL=section-content.skill.js.map