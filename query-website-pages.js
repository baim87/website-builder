const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.websiteData.findUnique({ where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' }});
  if (!data) {
    console.log("No data found");
    process.exit(1);
  }
  console.log("Status:", data.generationStatus);
  console.log("Has homePage:", !!data.homePage);
  console.log("Has aboutPage:", !!data.aboutPage);
  console.log("Has servicesPage:", !!data.servicesPage);
  console.log("Has contactPage:", !!data.contactPage);
  console.log("URL:", data.publishedUrl);
  process.exit(0);
}
main();
