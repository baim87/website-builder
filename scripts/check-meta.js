const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const context = await prisma.businessContext.findUnique({
    where: { projectId: '56ed4863-a3c5-4012-bed2-df152e9333d4' }
  });
  console.log(JSON.stringify(context.interviewMetadata, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
