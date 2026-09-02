import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GoogleAdsClient } from '../src/keywords/clients/google-ads.client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const googleAdsClient = app.get(GoogleAdsClient);

  try {
    console.log('Testing Google Ads Client...');
    const results = await googleAdsClient.fetchKeywords('Kitchen Remodeling', 'Peoria, AZ');
    console.log('Success! Results:', results);
  } catch (error: any) {
    console.error('Error Message:', error.message);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
