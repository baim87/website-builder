const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findFirst({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' } });
  if (data && data.customComponents && data.customComponents.FooterSection) {
    let footerCode = data.customComponents.FooterSection;
    
    // Replace hardcoded surface-dark-foreground with text-footer-foreground where appropriate
    footerCode = footerCode.replace(/text-surface-dark-foreground/g, 'text-footer-foreground');
    // We can also ensure it doesn't accidentally have double text-footer-foreground-foreground
    footerCode = footerCode.replace(/text-footer-foreground-foreground/g, 'text-footer-foreground');
    
    // Replace any remaining text-foreground with text-footer-foreground
    footerCode = footerCode.replace(/text-foreground/g, 'text-footer-foreground');
    // Fix any double replacements
    footerCode = footerCode.replace(/text-footer-footer-foreground/g, 'text-footer-foreground');

    const updated = { ...data.customComponents, FooterSection: footerCode };
    
    await prisma.websiteData.update({
      where: { id: data.id },
      data: { customComponents: updated }
    });
    console.log("Fixed FooterSection in DB");
  }
}
main().finally(() => prisma.$disconnect());
