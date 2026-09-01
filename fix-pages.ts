import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pages = await prisma.page.findMany();
  let updatedCount = 0;

  for (const page of pages) {
    const content = page.content as any;
    // Check if the content is an object containing 'sections' (our bad structure)
    if (content && typeof content === 'object' && !Array.isArray(content) && content.sections) {
      console.log(`Fixing page: ${page.slug} (Project: ${page.projectId})`);
      await prisma.page.update({
        where: { id: page.id },
        data: { content: content.sections },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully fixed ${updatedCount} pages.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
