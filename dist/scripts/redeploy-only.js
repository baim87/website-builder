"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const nextjs_builder_service_1 = require("../src/generation/nextjs-builder.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn', 'log'] });
    const prisma = app.get(prisma_service_1.PrismaService);
    const nextjsBuilder = app.get(nextjs_builder_service_1.NextjsBuilderService);
    try {
        const project = await prisma.project.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        if (!project) {
            console.error('No projects found!');
            process.exit(1);
        }
        console.log(`Triggering Vercel deployment ONLY for project: ${project.name} (${project.id})`);
        const liveUrl = await nextjsBuilder.buildAndDeploy(project.id);
        console.log('\n=============================================');
        console.log(`🎉 REDEPLOYMENT SUCCESSFUL!`);
        console.log(`🚀 Live URL: ${liveUrl}`);
        console.log('=============================================\n');
    }
    catch (error) {
        console.error('Failed:', error);
    }
    finally {
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=redeploy-only.js.map