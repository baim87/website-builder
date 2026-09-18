import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const projectId = 'f2062e3f-682e-4329-9fb2-3f058b41fc46';
  
  const pages = await prisma.page.findMany({ where: { projectId }});
  for (const page of pages) {
    if (page.componentCode) {
      console.log(`=== ${page.slug} COMPONENTS ===`);
      for (const [key, code] of Object.entries(page.componentCode)) {
         console.log(`--- ${key}.tsx ---`);
         console.log((code as string).substring(0, 150));
      }
    }
  }
  await app.close();
}

bootstrap();
