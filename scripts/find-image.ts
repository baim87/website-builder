import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: '61c5b4b8-664f-4395-87d2-6dc977e09e38' },
    include: { pages: true }
  });

  if (!project) return console.log("Project not found");
  
  const page = project.pages.find(p => p.slug === 'services/deck-repair');
  if (!page) return console.log("Page not found");
  
  const sections = (page.content as any[]) || [];
  const section = sections.find(s => s.type === 'ServiceDetailsSection');
  
  if (!section) return console.log("ServiceDetailsSection not found");
  
  console.log(JSON.stringify(section, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
