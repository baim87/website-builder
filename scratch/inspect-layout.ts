import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const page = await prisma.page.findUnique({
    where: { projectId_slug: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd', slug: 'layout' } }
  });
  console.log(JSON.stringify(page?.content, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
