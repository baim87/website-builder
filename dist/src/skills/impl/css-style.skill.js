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
var CSSStyleSkill_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSStyleSkill = void 0;
const common_1 = require("@nestjs/common");
const ai_gateway_service_1 = require("../../ai-gateway/ai-gateway.service");
const output_validator_service_1 = require("../../guardrails/output-validator.service");
const crypto = __importStar(require("crypto"));
let CSSStyleSkill = CSSStyleSkill_1 = class CSSStyleSkill {
    aiGateway;
    validator;
    name = 'CSSStyle';
    logger = new common_1.Logger(CSSStyleSkill_1.name);
    constructor(aiGateway, validator) {
        this.aiGateway = aiGateway;
        this.validator = validator;
    }
    async execute(input) {
        const { designSystem } = input.context;
        if (!designSystem || !designSystem.colors || !designSystem.typography) {
            throw new Error('CSSStyleSkill requires designSystem in context');
        }
        const prompt = `You are a Tailwind CSS configuration expert.
Given this design system, generate the CSS overrides for a modern Tailwind CSS v4 project.

DESIGN SYSTEM:
Colors: ${JSON.stringify(designSystem.colors, null, 2)}
Typography: ${JSON.stringify(designSystem.typography, null, 2)}

REQUIREMENTS:
1. Output valid CSS that defines CSS variables on the :root pseudo-class.
2. Define the @theme block to map these variables to Tailwind's color system (e.g., --color-primary: var(--color-primary);).
3. DO NOT include arbitrary pixel sizes for typography, use Tailwind's text scales.
4. The output must strictly follow this structure:

\`\`\`css
@import "tailwindcss";

:root {
  /* Define variables */
}

@theme {
  /* Override default theme */
}

@config {
  /* Disable arbitrary values by restricting the core plugins if necessary */
}
\`\`\`

Return ONLY the raw CSS code. No explanations.`;
        this.logger.log(`Generating global CSS configuration...`);
        const response = await this.aiGateway.generateText('claude-fable-5', {
            systemPrompt: 'You output ONLY raw CSS code. Do not wrap in markdown fences. Do not explain anything.',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            maxTokens: 8192,
        });
        let css = response.text.trim();
        const cssFenceMatch = css.match(/```(?:css)?\s*([\s\S]*?)\s*```/i);
        if (cssFenceMatch) {
            css = cssFenceMatch[1].trim();
        }
        try {
            this.validator.validateCSS(css);
        }
        catch (error) {
            this.logger.error(`Validation failed for generated CSS`, error);
            throw error;
        }
        const hash = crypto.createHash('sha256').update(css).digest('hex');
        return {
            data: css,
            hash,
            model: 'claude-fable-5',
        };
    }
};
exports.CSSStyleSkill = CSSStyleSkill;
exports.CSSStyleSkill = CSSStyleSkill = CSSStyleSkill_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_gateway_service_1.AIGatewayService,
        output_validator_service_1.OutputValidatorService])
], CSSStyleSkill);
//# sourceMappingURL=css-style.skill.js.map