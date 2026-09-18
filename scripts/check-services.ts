import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const projectId = "33401bfd-243d-4d62-bfd9-c81af6a77511";
  const context = await prisma.businessContext.findUnique({
    where: { projectId }
  });
  console.log("Services:", JSON.stringify(context?.services, null, 2));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
