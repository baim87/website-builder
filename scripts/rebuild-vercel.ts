import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NextjsBuilderService } from '../src/generation/nextjs-builder.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const nextjsBuilderService = app.get(NextjsBuilderService);

  const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
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
