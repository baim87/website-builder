import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: '61c5b4b8-664f-4395-87d2-6dc977e09e38' },
    include: { pages: true }
  });

  if (!project) return console.log("Project not found");
  
  const brands = [
    { name: 'Trex', logo: 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/global/brands/trex.com/logo.png' },
    { name: 'TimberTech', logo: 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/global/brands/timbertech.com/logo.png' },
    { name: 'Westbury Aluminum Railing', logo: 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/global/brands/diggerspecialties.com/logo.png' },
    { name: 'Fiberon', logo: 'https://pub-2875702039df4aaa92ef166f90ca2ce1.r2.dev/global/brands/fiberondecking.com/logo.png' }
  ];

  let updatedPages = 0;
  for (const page of project.pages) {
    let sections = (page.content as any[]) || [];
    let modified = false;
    
    sections = sections.map(section => {
      if (section.type === 'BrandsSection') {
        modified = true;
        if (!section.data) section.data = {};
        section.data.brands = brands;
        
        if (section.ast && section.ast.props && section.ast.props.data) {
          section.ast.props.data.brands = brands;
        }
      }
      return section;
    });

    if (modified) {
      await prisma.page.update({
        where: { id: page.id },
        data: { content: sections }
      });
      updatedPages++;
      console.log(`Updated BrandsSection on page ${page.slug}`);
    }
  }
  
  console.log(`Finished updating BrandsSection on ${updatedPages} pages.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
