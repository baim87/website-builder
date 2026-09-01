"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const pages = await prisma.page.findMany();
    let updatedCount = 0;
    for (const page of pages) {
        const content = page.content;
        if (content && typeof content === 'object' && !Array.isArray(content) && content.sections) {
            console.log(`Fixing page: ${page.slug} (Project: ${page.projectId})`);
            await prisma.page.update({
                where: { id: page.id },
                data: { content: content.sections },
            });
            updatedCount++;
        }
    }
    console.log(`Successfully fixed ${updatedCount} pages.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=fix-pages.js.map