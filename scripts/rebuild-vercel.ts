import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NextjsBuilderService } from '../src/generation/nextjs-builder.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const nextjsBuilderService = app.get(NextjsBuilderService);

  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  console.log(`Triggering rebuild and deploy for project: ${projectId}`);
  
  try {
    const url = await nextjsBuilderService.buildAndDeploy(projectId);
    console.log(`✅ Success! Redeployed to: ${url}`);
  } catch (error) {
    console.error('❌ Failed to redeploy:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
