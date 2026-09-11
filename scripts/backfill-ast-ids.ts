import { PrismaClient } from '@prisma/client';
import { injectNodeIds } from '../src/utils/ast-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting AST Node ID backfill...');
  const pages = await prisma.page.findMany();
  console.log(`Found ${pages.length} pages to process.`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const page of pages) {
    try {
      // Concurrency check: ensure page wasn't updated since we fetched it
      const currentDbPage = await prisma.page.findUnique({ where: { id: page.id } });
      
      if (!currentDbPage || currentDbPage.updatedAt.getTime() !== page.updatedAt.getTime()) {
        console.warn(`[WARN] Skipping page ${page.id} - updated since fetch`);
        skippedCount++;
        continue;
      }

      if (page.content && Array.isArray(page.content)) {
        const content = page.content.map((section: any) => {
          if (section.ast) {
            section.ast = injectNodeIds(section.ast);
          }
          return section;
        });

        await prisma.page.update({
          where: { id: page.id },
          data: { content },
        });
        
        updatedCount++;
      } else {
        // Skip pages without sections
        skippedCount++;
      }
    } catch (e) {
      console.error(`[ERROR] processing page ${page.id}`, e);
      errorCount++;
    }
  }
  
  console.log(`\nMigration complete.`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
