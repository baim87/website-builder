import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  
  const businessContext = await prisma.businessContext.findUnique({
    where: { projectId }
  });
  
  console.log('Project Status:', project?.status);
  console.log('Interview Metadata stepIndex:', (businessContext?.interviewMetadata as any)?.stepIndex);
  
  await prisma.$disconnect();
}

main().catch(console.error);
