"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const prisma_service_1 = require("./src/prisma/prisma.service");
const prisma_tenant_middleware_1 = require("./src/prisma/prisma-tenant.middleware");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const prisma = app.get(prisma_service_1.PrismaService);
    try {
        await prisma_tenant_middleware_1.tenantContext.run({ userId: 'test-user-id' }, async () => {
            console.log('Testing create Project...');
            await prisma.project.create({
                data: {
                    id: 'test-project-1',
                    name: 'Test Project',
                    userId: 'test-user-id',
                }
            });
            console.log('Project created successfully');
            console.log('Testing findUnique Project...');
            const p = await prisma.project.findUnique({
                where: { id: 'test-project-1' }
            });
            console.log('FindUnique returned:', p);
        });
    }
    catch (e) {
        console.error('Error during test:', e.message);
    }
    finally {
        try {
            await prisma.project.delete({ where: { id: 'test-project-1' } });
        }
        catch (e) { }
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=test-middleware.js.map