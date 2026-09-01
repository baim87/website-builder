"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationModule = void 0;
const common_1 = require("@nestjs/common");
const generation_service_1 = require("./generation.service");
const nextjs_builder_service_1 = require("./nextjs-builder.service");
const site_content_service_1 = require("./site-content.service");
const public_site_controller_1 = require("./public-site.controller");
const skills_module_1 = require("../skills/skills.module");
const projects_module_1 = require("../projects/projects.module");
const seo_module_1 = require("../seo/seo.module");
let GenerationModule = class GenerationModule {
};
exports.GenerationModule = GenerationModule;
exports.GenerationModule = GenerationModule = __decorate([
    (0, common_1.Module)({
        imports: [skills_module_1.SkillsModule, (0, common_1.forwardRef)(() => projects_module_1.ProjectsModule), seo_module_1.SeoModule],
        controllers: [public_site_controller_1.PublicSiteController],
        providers: [generation_service_1.GenerationService, nextjs_builder_service_1.NextjsBuilderService, site_content_service_1.SiteContentService],
        exports: [generation_service_1.GenerationService, nextjs_builder_service_1.NextjsBuilderService, site_content_service_1.SiteContentService],
    })
], GenerationModule);
//# sourceMappingURL=generation.module.js.map