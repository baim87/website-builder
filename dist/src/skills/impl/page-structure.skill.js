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
var PageStructureSkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageStructureSkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const crypto = __importStar(require("crypto"));
let PageStructureSkill = PageStructureSkill_1 = class PageStructureSkill {
    aiGateway;
    validator;
    name = 'PageStructure';
    logger = new common_1.Logger(PageStructureSkill_1.name);
    constructor(aiGateway, validator) {
        this.aiGateway = aiGateway;
        this.validator = validator;
    }
    async execute(input) {
        const pageSlug = input.context.pageSlug || 'home';
        const userDictatedStructures = {
            'home': [
                'HeroSection', 'AboutSection', 'ServicesSection', 'WhyUsSection',
                'GallerySection', 'TimelineSection', 'TestimonialsSection', 'CallToActionSection'
            ],
            'about-us': [
                'HeroSection', 'AboutSection', 'WhyUsSection', 'LocationsSection',
                'TestimonialsSection', 'CallToActionSection'
            ],
            'portfolio': [
                'HeroSection', 'GallerySection'
            ],
            'services': [
                'HeroSection', 'ServicesSection'
            ],
            'service-areas': [
                'HeroSection', 'LocationsSection', 'TestimonialsSection', 'CallToActionSection'
            ],
            'contact': [
                'HeroSection', 'LeadFormSection', 'FindUsSection'
            ]
        };
        if (userDictatedStructures[pageSlug]) {
            this.logger.log(`[${pageSlug}] Using hardcoded user-dictated page structure.`);
            const validatedData = this.validator.validate({ sections: userDictatedStructures[pageSlug] }, skill_outputs_schema_1.PageStructureSchema);
            const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
            return { data: validatedData, hash, model: 'hardcoded' };
        }
        if (input.context.isLocationServicePage || pageSlug.startsWith('services/') || pageSlug.startsWith('service-areas/')) {
            this.logger.log(`[${pageSlug}] Using hardcoded dynamic detail page structure.`);
            const detailStructure = ['PageHeaderSection', 'ServiceDetailsSection', 'GallerySection', 'BeforeAfterSection', 'TestimonialsSection', 'FaqSection', 'CallToActionSection'];
            const validatedData = this.validator.validate({ sections: detailStructure }, skill_outputs_schema_1.PageStructureSchema);
            const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
            return { data: validatedData, hash, model: 'hardcoded' };
        }
        const prompt = `Determine the layout for the "${pageSlug}" page of this contractor business.
Business Context: ${JSON.stringify(input.context.businessContext)}
Brand Voice: ${JSON.stringify(input.context.brandVoice)}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "sections": ["HeroSection", "ServicesSection", "AboutSection"]
}

SUPPORTED SECTION TYPES (You can ONLY pick from these):
- HeroSection: Used for top-of-page introductions on the home page.
- PageHeaderSection: Used for the smaller hero section at the top of detail pages (like service or location details).
- BrandsSection: Used to display trust badges, certifications, or partner logos.
- ServicesSection: Used to list services offered.
- AboutSection: Used for company history and team presentation.
- WhyUsSection: Used for value propositions and differentiators.
- BeforeAfterSection: Used to showcase project transformations.
- TimelineSection: Used to explain the process step-by-step.
- TestimonialsSection: Used for social proof and client reviews.
- LocationsSection: Used to list service areas.
- ServiceDetailsSection: Used for the detailed content body of a specific service.
- CallToActionSection: Used for the large bottom CTA block commonly found on pages.

Do not invent new section types. Just output the array of strings wrapped in the JSON object.`;
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            maxTokens: 8192,
            responseFormat: 'json',
        });
        this.logger.debug(`[${pageSlug}] PageStructure output: ${response.text}`);
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
            throw new Error(`PageStructure LLM returned unparseable output`);
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.PageStructureSchema);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.PageStructureSkill = PageStructureSkill;
exports.PageStructureSkill = PageStructureSkill = PageStructureSkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService])
], PageStructureSkill);
//# sourceMappingURL=page-structure.skill.js.map