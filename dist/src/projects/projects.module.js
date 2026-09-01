"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsModule = void 0;
const common_1 = require("@nestjs/common");
const projects_service_1 = require("./projects.service");
const projects_controller_1 = require("./projects.controller");
const business_context_service_1 = require("./business-context.service");
const website_data_service_1 = require("./website-data.service");
const page_service_1 = require("./page.service");
const google_places_service_1 = require("./google-places.service");
const prisma_module_1 = require("../prisma/prisma.module");
const queue_module_1 = require("../queue/queue.module");
let ProjectsModule = class ProjectsModule {
};
exports.ProjectsModule = ProjectsModule;
exports.ProjectsModule = ProjectsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, (0, common_1.forwardRef)(() => queue_module_1.QueueModule)],
        controllers: [projects_controller_1.ProjectsController],
        providers: [projects_service_1.ProjectsService, business_context_service_1.BusinessContextService, website_data_service_1.WebsiteDataService, page_service_1.PageService, google_places_service_1.GooglePlacesService],
        exports: [projects_service_1.ProjectsService, business_context_service_1.BusinessContextService, website_data_service_1.WebsiteDataService, page_service_1.PageService, google_places_service_1.GooglePlacesService],
    })
], ProjectsModule);
//# sourceMappingURL=projects.module.js.map