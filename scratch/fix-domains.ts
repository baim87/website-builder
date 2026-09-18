import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const domains = await prisma.domain.findMany();
  for (const domain of domains) {
    if (domain.domainName.includes('.vercel.app') && domain.domainName.includes('-')) {
      // If it has -git-main or random hash, we can clean it up.
      // But wait, the Vercel project name might have hyphens (e.g. remodeling-journey-2369).
      // We know Vercel appends -git-main-local-empire or a hash.
      // Actually, since we know the project name is usually everything before -git-main or -hash.
      // Let's just find projects and construct the proper domain.
      const project = await prisma.project.findUnique({ where: { id: domain.projectId }});
      if (project) {
        const expectedName = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${project.id.slice(-4)}.vercel.app`;
        if (domain.domainName !== expectedName && !domain.domainName.includes('contractingempire.com')) {
          console.log(`Updating ${domain.domainName} to ${expectedName}`);
          await prisma.domain.update({
            where: { id: domain.id },
            data: { domainName: expectedName }
          });
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
