"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OutputValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputValidatorService = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const component_contract_1 = require("./component-contract");
const css_contract_1 = require("./css-contract");
let OutputValidatorService = OutputValidatorService_1 = class OutputValidatorService {
    logger = new common_1.Logger(OutputValidatorService_1.name);
    validate(output, schema) {
        try {
            let data = output;
            if (typeof output === 'string') {
                let cleanOutput = output.trim();
                if (!cleanOutput.startsWith('{') && !cleanOutput.startsWith('[')) {
                    const match = cleanOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                    if (match && match[1]) {
                        cleanOutput = match[1].trim();
                    }
                    else {
                        const start = cleanOutput.indexOf('{');
                        const end = cleanOutput.lastIndexOf('}');
                        if (start !== -1 && end !== -1 && end > start) {
                            cleanOutput = cleanOutput.substring(start, end + 1);
                        }
                    }
                }
                data = cleanOutput ? JSON.parse(cleanOutput) : {};
            }
            const validated = schema.parse(data);
            this.deepValidateScope(validated);
            return validated;
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                this.logger.error(`Validation failed: ${error.message}`);
                throw new Error(`Output validation failed: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            }
            this.logger.error(`Failed to validate output. Raw text was: ${typeof output === "string" ? output : JSON.stringify(output)}\nError: ${error?.message}`);
            throw new Error(`Output is not valid: ${error?.message}`);
        }
    }
    deepValidateScope(obj) {
        if (typeof obj === 'string') {
            const refusalHeuristics = [
                /as an ai language model/i,
                /i am an ai/i,
                /i cannot fulfill/i,
                /i'm sorry, (but )?i cannot/i,
                /i don't have enough context/i,
                /against my programming/i,
            ];
            for (const regex of refusalHeuristics) {
                if (regex.test(obj)) {
                    this.logger.error(`LLM Refusal detected in output string: "${obj}"`);
                    throw new Error('LLM generated a refusal instead of valid scope content.');
                }
            }
        }
        else if (Array.isArray(obj)) {
            obj.forEach(item => this.deepValidateScope(item));
        }
        else if (obj && typeof obj === 'object') {
            Object.values(obj).forEach(value => this.deepValidateScope(value));
        }
    }
    validateKeywordPresence(title, h1, primaryKeyword) {
        const titleLower = title.toLowerCase();
        const h1Lower = h1.toLowerCase();
        const keywordWords = primaryKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const titleHasAllWords = keywordWords.every(word => titleLower.includes(word));
        const h1HasAllWords = keywordWords.every(word => h1Lower.includes(word));
        if (!titleHasAllWords) {
            throw new Error(`SEO Validation Failed: Title must contain primary keyword "${primaryKeyword}". Got: "${title}"`);
        }
        if (!h1HasAllWords) {
            throw new Error(`SEO Validation Failed: H1 must contain primary keyword "${primaryKeyword}". Got: "${h1}"`);
        }
    }
    validateComponentCode(code) {
        for (const pattern of component_contract_1.ComponentContract.forbiddenPatterns) {
            if (pattern.test(code)) {
                throw new Error(`Component Validation Failed: Found forbidden pattern: ${pattern.toString()}`);
            }
        }
        for (const pattern of component_contract_1.ComponentContract.requiredPatterns) {
            if (!pattern.test(code)) {
                throw new Error(`Component Validation Failed: Missing required pattern: ${pattern.toString()}`);
            }
        }
        const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const importPath = match[1];
            if (!component_contract_1.ComponentContract.allowedImports.includes(importPath)) {
                throw new Error(`Component Validation Failed: Unauthorized import found: "${importPath}"`);
            }
        }
    }
    validateCSS(css) {
        for (const pattern of css_contract_1.CSSContract.forbiddenClasses) {
            if (pattern.test(css)) {
                throw new Error(`CSS Validation Failed: Found forbidden class/pattern: ${pattern.toString()}`);
            }
        }
        for (const bp of css_contract_1.CSSContract.requiredBreakpoints) {
            const bpPattern = new RegExp(`${bp}:`);
            if (!bpPattern.test(css)) {
                this.logger.warn(`CSS Validation Warning: Did not find responsive breakpoint: ${bp}:`);
            }
        }
    }
    groundCheckContent(content, businessContext) {
        if (!businessContext)
            return;
        const contentStr = JSON.stringify(content).toLowerCase();
        if (businessContext.businessName) {
            const placeholders = ['acme corp', 'your company', 'company name'];
            for (const ph of placeholders) {
                if (contentStr.includes(ph)) {
                    throw new Error(`Grounding Validation Failed: Found placeholder business name "${ph}"`);
                }
            }
        }
        if (businessContext.location) {
            const locationPlaceholders = ['your city', 'city, state', 'your location'];
            for (const ph of locationPlaceholders) {
                if (contentStr.includes(ph)) {
                    throw new Error(`Grounding Validation Failed: Found placeholder location "${ph}"`);
                }
            }
        }
        const contactPlaceholders = ['123-456-7890', '555-555', 'email@example.com', 'your@email.com'];
        for (const ph of contactPlaceholders) {
            if (contentStr.includes(ph)) {
                throw new Error(`Grounding Validation Failed: Found placeholder contact info "${ph}"`);
            }
        }
    }
};
exports.OutputValidatorService = OutputValidatorService;
exports.OutputValidatorService = OutputValidatorService = OutputValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], OutputValidatorService);
//# sourceMappingURL=output-validator.service.js.map