const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const purposes = await prisma.asset.groupBy({
    by: ['purpose'],
    _count: true
  });
  console.log('All purposes in the Asset table:');
  console.log(JSON.stringify(purposes, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
