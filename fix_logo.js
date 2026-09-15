const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } });
  
  const assets = await prisma.asset.findMany({ where: { projectId: p.id } });
  const logoAsset = assets.reverse().find(a => a.purpose === 'logo');
  
  if (!logoAsset) {
    console.log("No logo found");
    return;
  }
  
  const pages = await prisma.page.findMany({ where: { projectId: p.id, slug: 'layout' } });
  if (pages.length === 0) return;
  
  const layout = pages[0];
  const content = layout.content;
  
  let modified = false;
  for (const block of content) {
    if (block.type === 'HeaderSection' || block.type === 'FooterSection') {
      if (block.ast && block.ast.props && block.ast.props.data) {
        if (block.ast.props.data.logoUrl && block.ast.props.data.logoUrl.includes('portrait')) {
          console.log(`Fixing ${block.type} logoUrl from ${block.ast.props.data.logoUrl} to ${logoAsset.url}`);
          block.ast.props.data.logoUrl = logoAsset.url;
          modified = true;
        }
      }
    }
  }
  
  if (modified) {
    await prisma.page.update({
      where: { id: layout.id },
      data: { content }
    });
    console.log("Updated layout AST in DB.");
  }
}

main().finally(() => prisma.$disconnect());
