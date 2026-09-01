"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const pages = await prisma.page.findMany({
        where: { projectId: '34680b7f-b27f-40bc-8b1d-9c9328ddcfef' }
    });
    console.log('Pages in DB:', pages.map(p => p.slug));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-pages.js.map