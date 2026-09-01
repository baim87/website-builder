import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { tenantContext } from './src/prisma/prisma-tenant.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);

  try {
    await tenantContext.run({ userId: 'test-user-id' }, async () => {
      console.log('Testing create Project...');
      await prisma.project.create({
        data: {
          id: 'test-project-1',
          name: 'Test Project',
          userId: 'test-user-id',
        }
      });
      console.log('Project created successfully');
      
      console.log('Testing findUnique Project...');
      const p = await prisma.project.findUnique({
        where: { id: 'test-project-1' }
      });
      console.log('FindUnique returned:', p);
    });
  } catch (e: any) {
    console.error('Error during test:', e.message);
  } finally {
    // cleanup
    try {
      await prisma.project.delete({ where: { id: 'test-project-1' } });
    } catch(e) {}
    await app.close();
  }
}

bootstrap();
