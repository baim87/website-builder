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
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const website_data_service_1 = require("../src/projects/website-data.service");
const page_service_1 = require("../src/projects/page.service");
const business_context_service_1 = require("../src/projects/business-context.service");
const fs = __importStar(require("fs/promises"));
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const websiteDataService = app.get(website_data_service_1.WebsiteDataService);
    const pageService = app.get(page_service_1.PageService);
    const businessContextService = app.get(business_context_service_1.BusinessContextService);
    const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
    const businessContext = await businessContextService.findByProjectId(projectId);
    const websiteData = await websiteDataService.findByProjectId(projectId);
    const pages = await pageService.getPagesByProjectId(projectId);
    const siteContent = {
        theme: websiteData?.designTokens,
        seo: websiteData?.seoMetadata,
        business: {
            name: businessContext?.businessName || '',
            phone: businessContext?.phone || '',
            email: businessContext?.email || '',
            address: businessContext?.businessAddress || '',
            tagline: '',
        },
        pages: pages.map((p) => ({ slug: p.slug, sections: p.content }))
    };
    await fs.writeFile('../scratch/content.json', JSON.stringify(siteContent, null, 2));
    console.log('Done!');
    await app.close();
}
bootstrap();
//# sourceMappingURL=dump-content.js.map