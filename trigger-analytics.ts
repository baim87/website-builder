import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AnalyticsProvisioningProducer } from './src/queue/producers/analytics-provisioning.producer';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const producer = app.get(AnalyticsProvisioningProducer);
  
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  // What is the domain? 
  // Let's get the domain from the Project or Domain table.
  const { PrismaService } = require('./src/prisma/prisma.service');
  const prisma = app.get(PrismaService);
  const domain = await prisma.domain.findFirst({ where: { projectId }});
  
  console.log(`Triggering analytics for domain: ${domain?.domainName}`);
  if (domain && domain.domainName) {
    // userId is probably from project
    const project = await prisma.project.findUnique({ where: { id: projectId }});
    await producer.provisionAnalytics(projectId, domain.domainName, project.userId);
    console.log("Successfully queued analytics provisioning.");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
