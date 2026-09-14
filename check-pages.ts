import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  
  const pages = await prisma.page.findMany({
    where: { projectId },
    select: { slug: true, status: true }
  });
  
  console.log('Pages:');
  console.table(pages);
  
  await prisma.$disconnect();
}

main().catch(console.error);
