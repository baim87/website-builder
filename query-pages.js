const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const pages = await prisma.page.findMany({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }, select: { slug: true, status: true } });
  console.log(pages);
  process.exit(0);
}
main();
