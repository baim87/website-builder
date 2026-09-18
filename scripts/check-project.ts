import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const p = await prisma.project.findUnique({
    where: { id: "33401bfd-243d-4d62-bfd9-c81af6a77511" },
    select: {
      id: true,
      domain: true,
    }
  });
  console.log(JSON.stringify(p, null, 2));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
