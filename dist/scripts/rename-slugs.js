"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const projectId = '34680b7f-b27f-40bc-8b1d-9c9328ddcfef';
    const pages = await prisma.page.findMany({
        where: {
            projectId,
            slug: {
                startsWith: 'locations'
            }
        }
    });
    for (const page of pages) {
        const newSlug = page.slug.replace('locations', 'service-areas');
        console.log(`Renaming ${page.slug} to ${newSlug}`);
        await prisma.page.update({
            where: {
                id: page.id
            },
            data: {
                slug: newSlug
            }
        });
    }
    console.log('Renamed successfully.');
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=rename-slugs.js.map