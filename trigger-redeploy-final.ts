import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { NextjsBuilderService } from './src/generation/nextjs-builder.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const nextjsBuilder = app.get(NextjsBuilderService);

  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error("not found");

  console.log("Triggering build and deploy with new GTM...");
  
  await nextjsBuilder.buildAndDeploy(
    projectId,
    project.userId,
    async () => {}
  );

  console.log("Successfully rebuilt!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
