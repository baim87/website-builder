const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findFirst({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' } });
  console.log(data.customComponents['HeaderSection']);
}
main().finally(() => prisma.$disconnect());
