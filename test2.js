const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } });
  const bc = await prisma.businessContext.findUnique({
    where: { projectId: p.id }
  });
  console.log(JSON.stringify(bc.interviewMetadata, null, 2));
}
main().finally(() => prisma.$disconnect());
