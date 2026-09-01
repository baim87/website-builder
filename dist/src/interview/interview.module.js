"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewModule = void 0;
const common_1 = require("@nestjs/common");
const interview_service_1 = require("./interview.service");
const interview_extractor_service_1 = require("./interview-extractor.service");
const interview_prompt_builder_1 = require("./interview-prompt.builder");
const projects_module_1 = require("../projects/projects.module");
const chat_module_1 = require("../chat/chat.module");
let InterviewModule = class InterviewModule {
};
exports.InterviewModule = InterviewModule;
exports.InterviewModule = InterviewModule = __decorate([
    (0, common_1.Module)({
        imports: [
            projects_module_1.ProjectsModule,
            (0, common_1.forwardRef)(() => chat_module_1.ChatModule),
        ],
        providers: [interview_service_1.InterviewService, interview_extractor_service_1.InterviewExtractorService, interview_prompt_builder_1.InterviewPromptBuilder],
        exports: [interview_service_1.InterviewService],
    })
], InterviewModule);
//# sourceMappingURL=interview.module.js.map