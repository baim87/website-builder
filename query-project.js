const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ctx = await prisma.businessContext.findUnique({
    where: { projectId: '05ccd7d1-c548-472d-8e6a-da595abf6ab9' }
  });
  console.log(JSON.stringify(ctx, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
