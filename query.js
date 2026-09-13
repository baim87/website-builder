const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ctx = await prisma.businessContext.findUnique({
    where: { projectId: 'aaabde9d-2599-4f4c-9106-aabb14aa66f4' }
  });
  console.log(ctx.serviceAreas);
}
main().catch(console.error).finally(() => prisma.$disconnect());
