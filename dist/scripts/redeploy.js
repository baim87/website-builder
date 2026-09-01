"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const nextjs_builder_service_1 = require("../src/generation/nextjs-builder.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const builder = app.get(nextjs_builder_service_1.NextjsBuilderService);
    const projectId = '34680b7f-b27f-40bc-8b1d-9c9328ddcfef';
    console.log(`Triggering redeployment for project: ${projectId}`);
    try {
        const url = await builder.buildAndDeploy(projectId);
        console.log('Deployment successful! URL:', url);
    }
    catch (error) {
        console.error('Deployment failed:', error);
    }
    finally {
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=redeploy.js.map