import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findMany({ orderBy: { updatedAt: 'desc' }, take: 1 });
  console.log(JSON.stringify(data, null, 2));
}
main();
