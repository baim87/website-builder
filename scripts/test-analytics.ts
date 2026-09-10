import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function testAnalytics() {
  console.log('Bootstrapping NestJS...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const analyticsService = app.get(AnalyticsService);
  const prisma = app.get(PrismaService);

  const projectId = 'c19b1d33-1c9d-46d1-93b6-4f8d12063b41';
  const domainName = 'crushexcavation.com';

  console.log('Cleaning up old analytics record for testing...');
  await prisma.siteAnalytics.deleteMany({ where: { projectId } });

  console.log(`Triggering Analytics Provisioning for ${domainName}...`);
  try {
    const result = await analyticsService.provisionAnalytics(projectId, domainName);
    console.log('SUCCESS! Provisioning Result:', result);
  } catch (error) {
    console.error('ERROR during provisioning:');
    console.error(error);
  } finally {
    await app.close();
  }
}

testAnalytics();
