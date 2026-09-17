import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  console.log(JSON.stringify(project, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
