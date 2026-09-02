"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var InterviewExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewExtractorService = void 0;
const common_1 = require("@nestjs/common");
let InterviewExtractorService = InterviewExtractorService_1 = class InterviewExtractorService {
    logger = new common_1.Logger(InterviewExtractorService_1.name);
    extract(agentResponse) {
        const regex = /<!--\s*EXTRACT:\s*({.*?})\s*-->/gs;
        const matches = [...agentResponse.matchAll(regex)];
        let extractedFields = {};
        let cleanResponse = agentResponse;
        if (matches.length > 0) {
            for (const match of matches) {
                try {
                    const parsed = JSON.parse(match[1]);
                    extractedFields = { ...extractedFields, ...parsed };
                }
                catch (e) {
                    this.logger.error('Failed to parse JSON from extract block', e);
                }
            }
            cleanResponse = agentResponse.replace(regex, '').trim();
        }
        return { cleanResponse, extractedFields };
    }
};
exports.InterviewExtractorService = InterviewExtractorService;
exports.InterviewExtractorService = InterviewExtractorService = InterviewExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], InterviewExtractorService);
//# sourceMappingURL=interview-extractor.service.js.map