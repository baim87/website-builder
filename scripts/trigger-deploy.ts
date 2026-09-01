import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GenerationService } from '../src/generation/generation.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const generationService = app.get(GenerationService);

  try {
    // Find the most recent project
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!project) {
      console.error('No projects found!');
      process.exit(1);
    }

    console.log(`Triggering generation for project: ${project.name} (${project.id})`);
    const liveUrl = await generationService.generateProject(project.id);

    console.log('\n=============================================');
    console.log(`DEPLOYMENT SUCCESSFUL!`);
    console.log(`Live URL: ${liveUrl}`);
    console.log('=============================================\n');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
