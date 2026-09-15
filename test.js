const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } });
  const chatMessages = await prisma.chatMessage.findMany({ 
    where: { projectId: p.id },
    orderBy: { createdAt: 'asc' }
  });
  
  for (const msg of chatMessages) {
    if (msg.content && msg.content.includes('http')) {
      console.log(`Msg from ${msg.role}: ${msg.content}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
