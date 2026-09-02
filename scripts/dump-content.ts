import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WebsiteDataService } from '../src/projects/website-data.service';
import { PageService } from '../src/projects/page.service';
import { BusinessContextService } from '../src/projects/business-context.service';
import * as fs from 'fs/promises';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const websiteDataService = app.get(WebsiteDataService);
  const pageService = app.get(PageService);
  const businessContextService = app.get(BusinessContextService);

  const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
  
  const businessContext = await businessContextService.findByProjectId(projectId);
  const websiteData = await websiteDataService.findByProjectId(projectId);
  const pages = await pageService.getPagesByProjectId(projectId);

  const siteContent = {
    theme: websiteData?.designTokens,
    seo: websiteData?.seoMetadata,
    business: {
      name: businessContext?.businessName || '',
      phone: businessContext?.phone || '',
      email: businessContext?.email || '',
      address: businessContext?.businessAddress || '',
      tagline: '',
    },
    pages: pages.map((p: any) => ({ slug: p.slug, sections: p.content }))
  };

  await fs.writeFile('../scratch/content.json', JSON.stringify(siteContent, null, 2));
  console.log('Done!');
  await app.close();
}

bootstrap();
