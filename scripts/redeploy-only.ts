import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NextjsBuilderService } from '../src/generation/nextjs-builder.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const nextjsBuilder = app.get(NextjsBuilderService);

  try {
    // Find the most recent project
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!project) {
      console.error('No projects found!');
      process.exit(1);
    }

    console.log(`Triggering Vercel deployment ONLY for project: ${project.name} (${project.id})`);
    
    // We are skipping the AI generation step because the API key expired,
    // and just deploying the already-saved DB contents to Vercel.
    const liveUrl = await nextjsBuilder.buildAndDeploy(project.id);
    
    console.log('\n=============================================');
    console.log(`🎉 REDEPLOYMENT SUCCESSFUL!`);
    console.log(`🚀 Live URL: ${liveUrl}`);
    console.log('=============================================\n');

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
