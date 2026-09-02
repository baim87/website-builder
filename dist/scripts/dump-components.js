"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const prisma = app.get(prisma_service_1.PrismaService);
    const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
    const pages = await prisma.page.findMany({ where: { projectId } });
    for (const page of pages) {
        if (page.componentCode) {
            console.log(`=== ${page.slug} COMPONENTS ===`);
            for (const [key, code] of Object.entries(page.componentCode)) {
                console.log(`--- ${key}.tsx ---`);
                console.log(code.substring(0, 150));
            }
        }
    }
    await app.close();
}
bootstrap();
//# sourceMappingURL=dump-components.js.map