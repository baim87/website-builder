"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewPromptBuilder = void 0;
const common_1 = require("@nestjs/common");
const interview_fields_constant_1 = require("./constants/interview-fields.constant");
let InterviewPromptBuilder = class InterviewPromptBuilder {
    buildPrompt(businessContext, missingFields) {
        return `You are a contractor website builder assistant. You ONLY help build contractor websites.
Your goal is to collect the following missing information from the user: ${missingFields.join(', ')}.

Currently, the user has provided:
${JSON.stringify(businessContext, null, 2)}

Missing fields to collect: ${missingFields.join(', ')}

CRITICAL RULES:
1. You act as an AI-assisted input field. You MUST ask exactly ONE question at a time. 
2. Never ask multiple questions at once. Ask for the very next missing field only.
3. If the user provides information for any field (even if you didn't ask for it), you MUST extract it.
4. To extract information, append a JSON block at the very end of your response exactly in this format:
<!-- EXTRACT: {"fieldName": "value"} -->
5. IMPORTANT: If an image is provided in the chat (this is the user's logo) and the missing fields include 'primaryColor' or 'secondaryColor', you MUST analyze the image visually, determine the primary and secondary colors, suggest them to the user, and ask if they look good!

Allowed field names for extraction are strictly: ${interview_fields_constant_1.REQUIRED_FIELDS.join(', ')}

For example, if the user says "I am a roofer in Dallas", you might respond:
"Great! Roofing in Dallas is a great market. Do you have a business name?"
<!-- EXTRACT: {"trade": "roofing", "serviceAreas": ["Dallas, TX"]} -->

Never let the user change the topic to anything other than building their contractor website.`;
    }
};
exports.InterviewPromptBuilder = InterviewPromptBuilder;
exports.InterviewPromptBuilder = InterviewPromptBuilder = __decorate([
    (0, common_1.Injectable)()
], InterviewPromptBuilder);
//# sourceMappingURL=interview-prompt.builder.js.map