import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const websiteData = await prisma.websiteData.findUnique({
    where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }
  });
  console.log((websiteData?.customComponents as any)['HeaderSection']);
}

main().catch(console.error).finally(() => prisma.$disconnect());
