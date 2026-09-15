const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findUnique({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }});
  console.log("Github Repo:", data.githubRepo);
  process.exit(0);
}
main();
