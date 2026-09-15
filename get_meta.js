const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  const bc = await prisma.businessContext.findUnique({
    where: { projectId: p.id }
  });
  console.log("Logo:", bc.interviewMetadata.finalLogoUrl);
  console.log("Portrait:", bc.interviewMetadata.finalPortraitUrl);
  
  const assets = await prisma.asset.findMany({ where: { projectId: p.id } });
  console.log("Assets:", assets.map(a => ({ purpose: a.purpose, url: a.url })));
}
main().finally(() => prisma.$disconnect());
