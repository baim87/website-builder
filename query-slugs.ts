import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const pages = await prisma.page.findMany({ select: { slug: true } });
  console.log(pages.map(p => p.slug).join(', '));
}
main().finally(() => prisma.$disconnect());
