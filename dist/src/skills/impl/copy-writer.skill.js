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
var CopyWriterSkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyWriterSkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto = __importStar(require("crypto"));
let CopyWriterSkill = CopyWriterSkill_1 = class CopyWriterSkill {
    aiGateway;
    validator;
    prisma;
    name = 'CopyWriter';
    logger = new common_1.Logger(CopyWriterSkill_1.name);
    constructor(aiGateway, validator, prisma) {
        this.aiGateway = aiGateway;
        this.validator = validator;
        this.prisma = prisma;
    }
    async execute(input) {
        const { sectionType, businessContext, brandVoice, seoMeta, pageSlug } = input.context;
        if (!sectionType || !businessContext) {
            throw new Error('CopyWriterSkill requires sectionType and businessContext in context');
        }
        const keywordsContext = seoMeta?.keywords ? `TARGET SEO KEYWORDS TO INCLUDE: ${seoMeta.keywords.join(', ')}` : '';
        let sectionSpecificRules = '';
        if (sectionType === 'AboutSection') {
            sectionSpecificRules = `5. IMPORTANT: You must include the business owner's name: ${businessContext.contactPerson || 'The Owner'} in the copy. Make it a personal, professional about us section.`;
        }
        else if (sectionType === 'WhyUsSection') {
            sectionSpecificRules = `5. IMPORTANT: Highlight Unique Selling Propositions (USPs).`;
        }
        else if (sectionType === 'GallerySection') {
            let galleryRules = `5. IMPORTANT: Provide a highly descriptive 'alt' tag, and use a relevant Unsplash placeholder URL (e.g., "UNSPLASH:luxury modern bathroom") for EVERY service listed in the business context 'services' array.`;
            if (pageSlug === 'portfolio') {
                galleryRules += `\n6. IMPORTANT PORTFOLIO RULE: Generate specific portfolio case studies.`;
            }
            sectionSpecificRules = galleryRules;
        }
        else if (sectionType === 'TimelineSection') {
            sectionSpecificRules = `5. IMPORTANT: Generate a MAXIMUM of 4 process steps.`;
        }
        else if (sectionType === 'HeroSection') {
            let heroRules = `5. IMPORTANT: Generate a strong, conversion-optimized hero headline. Include a primary Call to Action (CTA).`;
            if (pageSlug === 'portfolio') {
                heroRules += `\n6. IMPORTANT PORTFOLIO RULE: Mention specific services like ${businessContext.services?.join(', ')}.`;
            }
            else if (pageSlug === 'service-areas') {
                heroRules += `\n6. IMPORTANT SERVICE AREAS RULE: You MUST explicitly mention the target service areas (from the business context) that have high search volume within the Hero copy.`;
            }
            sectionSpecificRules = heroRules;
        }
        else if (sectionType === 'ServicesSection') {
            sectionSpecificRules = `5. IMPORTANT: Generate copy for EVERY service listed in the business context 'services' array.`;
        }
        else if (sectionType === 'LocationsSection') {
            sectionSpecificRules = `5. IMPORTANT: Generate copy for EVERY service area listed in the business context 'serviceAreas' array.`;
        }
        else if (sectionType === 'FaqSection') {
            sectionSpecificRules = `5. IMPORTANT: You MUST generate between 3 and 6 relevant Frequently Asked Questions.`;
        }
        else if (sectionType === 'FindUsSection') {
            sectionSpecificRules = `5. IMPORTANT: Ensure the exact address, phone, email, and hours from the business context are included perfectly.`;
        }
        else if (sectionType === 'TestimonialsSection') {
            sectionSpecificRules = `5. IMPORTANT: Generate 3 realistic testimonials relevant to the target services. Include a fictional customer name and a 5-star rating.`;
        }
        let locationMetricsStr = '';
        if (pageSlug === 'service-areas' && input.projectId) {
            const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
                where: { projectId: input.projectId }
            });
            if (locationMetrics.length > 0) {
                locationMetricsStr = `\nLOCATION KEYWORD METRICS:\n${JSON.stringify(locationMetrics, null, 2)}\nIMPORTANT: Use these highest volume keywords specifically for the location cards and hero copy!`;
            }
        }
        let locationServiceRules = '';
        let targetService = '';
        if (pageSlug.startsWith('services/') || input.context.isLocationServicePage) {
            const parts = pageSlug.split('/');
            const rawServiceSlug = parts.length === 2 ? parts[1] : parts[parts.length - 1];
            targetService = rawServiceSlug.replace(/-/g, ' ');
            locationServiceRules += `\nCRITICAL CONTEXT:\nThis page is STRICTLY dedicated to "${targetService}". ALL content generated for this section MUST exclusively talk about "${targetService}".`;
        }
        if (input.context.isLocationServicePage) {
            const citySlug = pageSlug.split('/')[0];
            const targetCity = citySlug.replace(/-/g, ' ');
            locationServiceRules += `\n\nFurthermore, this is a highly localized Service Area Detail page. You must explicitly mention BOTH the specific Service ("${targetService}") and the specific City ("${targetCity}") throughout the copy to maximize local SEO relevance.`;
        }
        const prompt = `You are an expert full-stack developer, copywriter, and UI designer for a contractor website.
Write the UI AST and copy for a "${sectionType}".

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND VOICE:
${JSON.stringify(brandVoice || {}, null, 2)}

${keywordsContext}
${locationMetricsStr}
${locationServiceRules}

RULES:
1. You MUST generate the exact text required for the section.
2. For images, generate an Unsplash query string formatted as "UNSPLASH:query".
3. Write compelling, high-converting copy that matches the brand voice.
4. Output a single JSON object (key-value map) containing all headlines, subheadlines, paragraphs, lists, and image queries.
5. Provide a flexible structure that a UI Designer can easily map into a layout.
${sectionSpecificRules}

OUTPUT FORMAT:
Return a JSON object matching this general structure, adapted for the specific section Type:
{
  "badge": "Top Rated in Sydney",
  "headline": "Your Main Headline Here",
  "subheadline": "Your secondary text here.",
  "items": [
    {
      "title": "Item 1",
      "description": "Description 1",
      "imageQuery": "UNSPLASH:modern kitchen",
      "icon": "Award"
    }
  ],
  "callToAction": {
    "text": "Get a Quote",
    "href": "/contact"
  }
}
      `;
        this.logger.log(`Generating copy for ${sectionType}...`);
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            maxTokens: 8192,
            responseFormat: 'json',
        });
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
            throw new Error(`CopyWriter LLM returned unparseable output: ${response.text.substring(0, 200)}`);
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.CopyDataSchema);
        this.validator.groundCheckContent(validatedData, businessContext);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.CopyWriterSkill = CopyWriterSkill;
exports.CopyWriterSkill = CopyWriterSkill = CopyWriterSkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService,
        prisma_service_1.PrismaService])
], CopyWriterSkill);
//# sourceMappingURL=copy-writer.skill.js.map