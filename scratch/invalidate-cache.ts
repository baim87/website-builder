import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SiteContentService } from '../src/generation/site-content.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const siteContentService = app.get(SiteContentService);
  
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  await siteContentService.invalidateCache(projectId);
  console.log(`Cache invalidated for project ${projectId}`);
  
  await app.close();
}

main().catch(console.error);
