import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const websiteData = await prisma.websiteData.findUnique({
    where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }
  });
  
  let updated = false;
  const customComponents = websiteData?.customComponents as any;

  if (customComponents['HeaderSection']) {
    let code = customComponents['HeaderSection'];
    // Replace bg-background with bg-header-bg text-header-foreground in the main header tag
    if (code.includes('bg-background')) {
      code = code.replace(/bg-background\/95/g, 'bg-header-bg/95 text-header-foreground');
      code = code.replace(/bg-background/g, 'bg-header-bg text-header-foreground');
      customComponents['HeaderSection'] = code;
      updated = true;
    }
  }

  if (customComponents['FooterSection']) {
    let code = customComponents['FooterSection'];
    // Replace bg-background or bg-surface-dark with bg-footer-bg text-footer-foreground
    if (code.includes('bg-background') || code.includes('bg-surface-dark')) {
      code = code.replace(/bg-background/g, 'bg-footer-bg text-footer-foreground');
      code = code.replace(/bg-surface-dark/g, 'bg-footer-bg text-footer-foreground');
      customComponents['FooterSection'] = code;
      updated = true;
    }
  }

  if (updated) {
    await prisma.websiteData.update({
      where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' },
      data: { customComponents }
    });
    console.log('Components patched!');
  } else {
    console.log('No components needed patching.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
