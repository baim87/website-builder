const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  const pages = await prisma.page.findMany({ where: { projectId: p.id, slug: 'layout' } });
  console.log(JSON.stringify(pages[0].content, null, 2));
}
main().finally(() => prisma.$disconnect());
