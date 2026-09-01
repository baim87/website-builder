import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      businessContext: true,
      websiteData: true,
      pages: true,
      assets: true
    }
  });

  if (!project) {
    console.log('No project found');
    return;
  }

  // Dump to JSON file
  fs.writeFileSync('db-dump.json', JSON.stringify(project, null, 2));
  console.log('Saved to db-dump.json');
}

run().catch(console.error).finally(() => prisma.$disconnect());
