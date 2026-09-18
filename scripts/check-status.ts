import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const websiteData = await prisma.websiteData.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      projectId: true,
      generationStatus: true,
      project: { select: { status: true } }
    }
  });
  console.log("Latest Project Status:");
  console.log(JSON.stringify(websiteData, null, 2));
  
  const pages = await prisma.page.findMany({
    where: { projectId: websiteData?.projectId },
    select: { slug: true, status: true }
  });
  console.log("\nPages Status:");
  console.log(pages.map(p => `${p.slug}: ${p.status}`).join('\n'));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
