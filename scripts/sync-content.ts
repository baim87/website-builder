import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: '61c5b4b8-664f-4395-87d2-6dc977e09e38' },
    include: { pages: true }
  });

  if (!project) return console.log("Project not found");
  
  const contentPath = path.resolve(__dirname, '../../deck-bros-61c5/src/data/content.json');
  
  const siteContent = {
    project: {
      id: project.id,
      name: project.name
    },
    pages: project.pages.map(p => ({
      id: p.id,
      slug: p.slug,
      sections: p.content
    }))
  };

  fs.writeFileSync(contentPath, JSON.stringify(siteContent, null, 2));
  console.log("Successfully synced content.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
