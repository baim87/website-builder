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
  
  let sections = (page.content as any[]) || [];
  let modified = false;

  sections = sections.map(s => {
    if (s.type === 'ServiceDetailsSection' && s.ast?.props?.data) {
      s.ast.props.data.image = 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/18794b68-1f81-4c6c-8ac6-68f857348ac3/projects/21ebe79f-17b4-4a59-8b13-c2695b97e8e0/assets/images/before-after/deck-repair/after-deck-repair-2026-09-08-1c98d670.webp';
      modified = true;
    }
    return s;
  });

  if (modified) {
    await prisma.page.update({
      where: { id: page.id },
      data: { content: sections }
    });
    console.log("Successfully updated image");
  } else {
    console.log("Section not found or missing ast.props.data");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
