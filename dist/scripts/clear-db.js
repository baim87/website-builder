"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Clearing database...');
    await prisma.page.deleteMany({});
    await prisma.websiteData.deleteMany({});
    await prisma.project.deleteMany({});
    console.log('Database cleared successfully.');
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=clear-db.js.map