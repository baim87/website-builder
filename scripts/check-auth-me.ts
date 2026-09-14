import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const userId = (await prisma.user.findFirst())?.id;
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { projects: true }
  });
  console.log("User projects length:", user?.projects?.length);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
