import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  const logoUrl = 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/users/c2d36645-cabb-45fa-abb0-6273d4604be5/projects/23698e47-6b42-4701-8379-f039dad9dabd/assets/images/logo/2026-09-14-2a17f763-original.webp';
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { businessContext: true }
  });

  if (project?.businessContext) {
    const metaData = (project.businessContext.interviewMetadata as any) || {};
    metaData.finalLogoUrl = logoUrl;
    
    await prisma.businessContext.update({
      where: { id: project.businessContext.id },
      data: { interviewMetadata: metaData }
    });
    console.log('Updated logo in database successfully!');
  } else {
    console.log('BusinessContext not found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
