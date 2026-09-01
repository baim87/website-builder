import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bc = await prisma.businessContext.findUnique({
    where: { projectId: '34680b7f-b27f-40bc-8b1d-9c9328ddcfef' }
  });
  console.log('Services:', bc?.services);
  console.log('Service Areas:', bc?.serviceAreas);
}

main().finally(() => prisma.$disconnect());
