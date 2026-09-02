import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.page.deleteMany({});
  await prisma.websiteData.deleteMany({});
  await prisma.project.deleteMany({});
  console.log('Database cleared successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
