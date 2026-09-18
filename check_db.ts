import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const page = await prisma.page.findUnique({
    where: { projectId_slug: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd', slug: 'home' } }
  });
  if (!page) {
    console.log('Page not found');
    return;
  }
  const content = page.content as any[];
  console.log(content.map(s => ({ id: s.id, type: s.type })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
