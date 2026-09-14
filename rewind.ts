import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  
  // Rewind Project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'ONBOARDING' }
  });
  
  // Fetch existing context
  const businessContext = await prisma.businessContext.findUnique({
    where: { projectId }
  });
  
  const currentMeta = businessContext?.interviewMetadata as any || {};
  const newMeta = {
    ...currentMeta,
    stepIndex: 4, // 4 is brand-recap
    'brand-recap_state': 'initial' // Reset state so it re-renders the recap
  };
  
  // Update BusinessContext
  await prisma.businessContext.update({
    where: { projectId },
    data: { interviewMetadata: newMeta }
  });
  
  console.log('Successfully rewound project to Brand Recap step.');
  await prisma.$disconnect();
}

main().catch(console.error);
