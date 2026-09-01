import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NextjsBuilderService } from '../src/generation/nextjs-builder.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const builder = app.get(NextjsBuilderService);
  
  const projectId = '34680b7f-b27f-40bc-8b1d-9c9328ddcfef';
  console.log(`Triggering redeployment for project: ${projectId}`);
  
  try {
    const url = await builder.buildAndDeploy(projectId);
    console.log('Deployment successful! URL:', url);
  } catch (error) {
    console.error('Deployment failed:', error);
  } finally {
    await app.close();
  }
}
bootstrap();
