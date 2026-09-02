"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsModule = void 0;
const common_1 = require("@nestjs/common");
const skill_logger_service_1 = require("./skill-logger.service");
const skill_executor_service_1 = require("./skill-executor.service");
const brand_identity_skill_1 = require("./impl/brand-identity.skill");
const brand_voice_skill_1 = require("./impl/brand-voice.skill");
const design_system_skill_1 = require("./impl/design-system.skill");
const seo_metadata_skill_1 = require("./impl/seo-metadata.skill");
const page_structure_skill_1 = require("./impl/page-structure.skill");
const section_content_skill_1 = require("./impl/section-content.skill");
const keyword_strategy_skill_1 = require("./impl/keyword-strategy.skill");
const css_style_skill_1 = require("./impl/css-style.skill");
const copy_writer_skill_1 = require("./impl/copy-writer.skill");
const ui_designer_skill_1 = require("./impl/ui-designer.skill");
const orchestrator_service_1 = require("./orchestrator.service");
const ai_gateway_module_1 = require("../ai-gateway/ai-gateway.module");
const prisma_module_1 = require("../prisma/prisma.module");
const guardrails_module_1 = require("../guardrails/guardrails.module");
const keywords_module_1 = require("../keywords/keywords.module");
const unsplash_service_1 = require("../images/unsplash.service");
let SkillsModule = class SkillsModule {
};
exports.SkillsModule = SkillsModule;
exports.SkillsModule = SkillsModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_gateway_module_1.AIGatewayModule, prisma_module_1.PrismaModule, guardrails_module_1.GuardrailsModule, keywords_module_1.KeywordsModule],
        providers: [
            skill_logger_service_1.SkillLoggerService,
            skill_executor_service_1.SkillExecutorService,
            brand_identity_skill_1.BrandIdentitySkill,
            brand_voice_skill_1.BrandVoiceSkill,
            design_system_skill_1.DesignSystemSkill,
            seo_metadata_skill_1.SeoMetadataSkill,
            page_structure_skill_1.PageStructureSkill,
            section_content_skill_1.SectionContentSkill,
            keyword_strategy_skill_1.KeywordStrategySkill,
            css_style_skill_1.CSSStyleSkill,
            copy_writer_skill_1.CopyWriterSkill,
            ui_designer_skill_1.UIDesignerSkill,
            orchestrator_service_1.OrchestratorService,
            unsplash_service_1.UnsplashService,
        ],
        exports: [skill_executor_service_1.SkillExecutorService, orchestrator_service_1.OrchestratorService],
    })
], SkillsModule);
//# sourceMappingURL=skills.module.js.map