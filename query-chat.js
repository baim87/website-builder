const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const msgs = await prisma.chatMessage.findMany({
    where: { projectId: '05ccd7d1-c548-472d-8e6a-da595abf6ab9' },
    orderBy: { createdAt: 'asc' }
  });
  msgs.forEach(m => console.log(`${m.role}: ${m.content}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
