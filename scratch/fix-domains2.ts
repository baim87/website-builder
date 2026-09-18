import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.domain.updateMany({
    where: { domainName: 'journey-remodeling-dabd.vercel.app' },
    data: { domainName: 'remodeling-journey-2369.vercel.app' }
  });
  console.log('Fixed');
}

main().catch(console.error).finally(() => prisma.$disconnect());
