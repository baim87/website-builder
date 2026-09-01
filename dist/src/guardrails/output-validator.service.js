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
};
exports.OutputValidatorService = OutputValidatorService;
exports.OutputValidatorService = OutputValidatorService = OutputValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], OutputValidatorService);
//# sourceMappingURL=output-validator.service.js.map