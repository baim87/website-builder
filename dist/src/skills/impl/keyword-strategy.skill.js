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
var KeywordStrategySkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordStrategySkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const keywords_service_1 = require("../../keywords/keywords.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const skill_outputs_schema_1 = require("../schemas/skill-outputs.schema");
const crypto = __importStar(require("crypto"));
let KeywordStrategySkill = KeywordStrategySkill_1 = class KeywordStrategySkill {
    aiGateway;
    keywordsService;
    prisma;
    validator;
    name = 'KeywordStrategy';
    logger = new common_1.Logger(KeywordStrategySkill_1.name);
    constructor(aiGateway, keywordsService, prisma, validator) {
        this.aiGateway = aiGateway;
        this.keywordsService = keywordsService;
        this.prisma = prisma;
        this.validator = validator;
    }
    async execute(input) {
        const { businessContext, pages } = input.context;
        const projectId = input.projectId;
        if (!businessContext || !businessContext.trade || !businessContext.location || !projectId) {
            throw new Error('KeywordStrategySkill requires businessContext with trade and location, and projectId');
        }
        this.logger.log(`Fetching keywords for ${businessContext.trade} in ${businessContext.location}`);
        const keywords = await this.keywordsService.getKeywords(businessContext.trade, businessContext.location);
        const serviceKeywords = [];
        const servicesList = businessContext.services || [];
        for (const service of servicesList) {
            const name = typeof service === 'string' ? service : (service.name || service.title || 'Unknown Service');
            if (name !== 'Unknown Service') {
                try {
                    const kws = await this.keywordsService.getKeywords(name, businessContext.location);
                    serviceKeywords.push({ service: name, keywords: kws });
                }
                catch (error) {
                    this.logger.warn(`Failed to fetch keywords for service: ${name}`, error);
                }
            }
        }
        const locationMetrics = await this.prisma.locationKeywordMetrics.findMany({
            where: { projectId }
        });
        const prompt = `You are an SEO strategist. Assign target keywords to the pages for a contractor website.

BUSINESS CONTEXT:
Trade: ${businessContext.trade}
Location: ${businessContext.location}

REAL KEYWORD DATA (from Google Ads, with actual monthly search volumes):
${JSON.stringify(keywords.slice(0, 50))} // Limiting to top 50 to avoid massive token usage

SERVICE-SPECIFIC KEYWORDS:
${JSON.stringify(serviceKeywords.map(sk => ({ service: sk.service, keywords: sk.keywords.slice(0, 10) })))}

LOCATION RADIUS KEYWORD METRICS (For Service Area Pages/Cards):
${JSON.stringify(locationMetrics)}

PAGES TO ASSIGN:
${JSON.stringify(pages)}

RULES:
- Each page gets exactly 1 primary keyword (highest volume, most relevant to the page's intent)
- Each page gets 2-4 secondary keywords
- DO NOT assign the same primary keyword to multiple pages (no keyword cannibalization)
- Match search intent: "home" = broad commercial, "services/x" = specific service, "service-areas/x" = local
- Prioritize keywords with higher search volume, but make sure they are highly relevant to the specific page.

You MUST respond with ONLY a JSON object in this EXACT structure:
{
  "pages": [
    {
      "slug": "string (the page slug)",
      "primaryKeyword": { "keyword": "string", "volume": number },
      "secondaryKeywords": [ { "keyword": "string", "volume": number } ],
      "searchIntent": "commercial" | "informational" | "local"
    }
  ]
}`;
        this.logger.log('Generating keyword strategy with AI...');
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
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
            throw new Error(`KeywordStrategy LLM returned unparseable output: ${response.text.substring(0, 200)}`);
        }
        const validatedData = this.validator.validate(parsed, skill_outputs_schema_1.KeywordStrategySchema);
        const hash = crypto.createHash('sha256').update(JSON.stringify(validatedData)).digest('hex');
        return {
            data: validatedData,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.KeywordStrategySkill = KeywordStrategySkill;
exports.KeywordStrategySkill = KeywordStrategySkill = KeywordStrategySkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        keywords_service_1.KeywordsService,
        prisma_service_1.PrismaService,
        output_validator_service_1.OutputValidatorService])
], KeywordStrategySkill);
//# sourceMappingURL=keyword-strategy.skill.js.map