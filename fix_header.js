const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findFirst({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' } });
  if (data && data.customComponents && data.customComponents.HeaderSection) {
    let headerCode = data.customComponents.HeaderSection;
    
    // Replace hardcoded text-foreground with text-header-foreground where appropriate
    headerCode = headerCode.replace(/text-foreground\/80/g, 'text-header-foreground/80');
    headerCode = headerCode.replace(/hover:text-foreground/g, 'hover:text-header-foreground');
    headerCode = headerCode.replace(/text-foreground/g, 'text-header-foreground');
    // Fix any double replacements
    headerCode = headerCode.replace(/text-header-header-foreground/g, 'text-header-foreground');

    const updated = { ...data.customComponents, HeaderSection: headerCode };
    
    await prisma.websiteData.update({
      where: { id: data.id },
      data: { customComponents: updated }
    });
    console.log("Fixed HeaderSection in DB");
  }
}
main().finally(() => prisma.$disconnect());
