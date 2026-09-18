import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  if (!p) return;
  const pages = await prisma.page.findMany({ where: { projectId: p.id, slug: 'home' } });
  if (pages.length) console.log(JSON.stringify(pages[0].content, null, 2));
}
main().finally(() => prisma.$disconnect());
