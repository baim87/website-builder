const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.domain.update({
    where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' },
    data: { domainName: 'remodeling-journey-2369-9h5g96a6f-local-empire.vercel.app' }
  });
  console.log("Domain updated successfully");
  process.exit(0);
}
main();
