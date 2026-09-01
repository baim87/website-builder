"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputSanitizerService = void 0;
const common_1 = require("@nestjs/common");
let InputSanitizerService = class InputSanitizerService {
    promptInjectionHeuristics = [
        /ignore (all )?previous instructions/i,
        /system prompt/i,
        /you are now/i,
        /bypass/i,
        /jailbreak/i,
        /forget everything/i,
        /disregard/i,
        /do not follow/i,
        /from now on/i,
        /print your instructions/i,
        /what are your instructions/i,
        /^[\W_]+$/i,
    ];
    piiHeuristics = [
        /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,
        /\b(?:\d[ -]*?){13,16}\b/,
    ];
    sanitize(input) {
        if (!input || typeof input !== 'string')
            return '';
        let clean = input.replace(/<[^>]*>?/gm, '');
        for (const regex of this.promptInjectionHeuristics) {
            if (regex.test(clean)) {
                throw new common_1.BadRequestException('Potentially unsafe prompt injection detected. Please rephrase.');
            }
        }
        for (const regex of this.piiHeuristics) {
            if (regex.test(clean)) {
                throw new common_1.BadRequestException('Sensitive information (PII) detected. Please do not share SSNs or Credit Card numbers.');
            }
        }
        clean = clean.replace(/\s{3,}/g, ' ').trim();
        return clean;
    }
};
exports.InputSanitizerService = InputSanitizerService;
exports.InputSanitizerService = InputSanitizerService = __decorate([
    (0, common_1.Injectable)()
], InputSanitizerService);
//# sourceMappingURL=input-sanitizer.service.js.map