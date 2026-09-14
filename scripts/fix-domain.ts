import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const projectId = "33401bfd-243d-4d62-bfd9-c81af6a77511";
  const domainName = "fencing-company-of-omaha-3340.vercel.app";
  
  await prisma.domain.upsert({
    where: { projectId },
    create: {
      projectId,
      domainName,
      provider: 'vercel',
      status: 'active'
    },
    update: {
      domainName
    }
  });
  console.log("Domain fixed!");
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
