import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Ga4Client } from '../src/analytics/clients/ga4.client';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const ga4Client = app.get(Ga4Client);

  const analytics = await prisma.siteAnalytics.findUnique({
    where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' },
  });

  if (analytics?.ga4PropertyId) {
    console.log('Testing getRealtimeReport...');
    const data = await ga4Client.getRealtimeReport(analytics.ga4PropertyId);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('No GA4 Property ID found.');
  }

  await app.close();
}

main().catch(console.error);
