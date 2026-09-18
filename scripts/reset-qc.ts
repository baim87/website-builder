import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2] || '61c5b4b8-664f-4395-87d2-6dc977e09e38';
  
  // 1. Reset WebsiteData QC state so it will trigger the QC process again
  await prisma.websiteData.update({
    where: { projectId },
    data: {
      qcStatus: 'standby',
      qcReport: {}, // Clear the previous report
    },
  });
  
  // 2. Delete the final QA_AUDIT cache so it generates a fresh final report.
  // We deliberately do NOT delete QA_PAGE_AUDIT so that your 23 pages of 
  // Vision AI checkpoints are preserved, saving you time and API credits!
  await prisma.skillInvocation.deleteMany({
    where: {
      projectId,
      skillType: 'QA_AUDIT'
    }
  });
  
  console.log(`✅ Successfully reset QC state for project: ${projectId}`);
  console.log(`✅ Cleared final QA_AUDIT report cache.`);
  console.log(`✅ Kept per-page QA_PAGE_AUDIT checkpoints intact for speed!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
