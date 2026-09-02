"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const nextjs_builder_service_1 = require("../src/generation/nextjs-builder.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const nextjsBuilderService = app.get(nextjs_builder_service_1.NextjsBuilderService);
    const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
    console.log(`Triggering rebuild and deploy for project: ${projectId}`);
    try {
        const url = await nextjsBuilderService.buildAndDeploy(projectId);
        console.log(`✅ Success! Redeployed to: ${url}`);
    }
    catch (error) {
        console.error('❌ Failed to redeploy:', error);
    }
    finally {
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=rebuild-vercel.js.map