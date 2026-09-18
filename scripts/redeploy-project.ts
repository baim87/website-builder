import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NextjsBuilderService } from '../src/generation/nextjs-builder.service';
import { PrismaService } from '../src/prisma/prisma.service';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
};

function banner(title: string) {
  const width = Math.max(title.length + 4, 45);
  console.log(`${c.cyan}┌${'─'.repeat(width)}┐${c.reset}`);
  console.log(
    `${c.cyan}│${c.reset}${c.bold}${c.white}${title.padStart((width + title.length) / 2).padEnd(width)}${c.reset}${c.cyan}│${c.reset}`,
  );
  console.log(`${c.cyan}└${'─'.repeat(width)}┘${c.reset}`);
}

async function main() {
  const projectId = process.argv[2] || '252fdc2d-8702-44cb-98cb-e9ee5e8408d2';

  console.log();
  banner('Redeploy Project');
  console.log(`\n  Project: ${c.cyan}${projectId}${c.reset}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });

  const prisma = app.get(PrismaService);
  const nextjsBuilder = app.get(NextjsBuilderService);

  // 1. Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    console.log(`${c.red}  ✗ Project not found${c.reset}`);
    process.exit(1);
  }

  console.log(`  ${c.green}✓${c.reset} Found project: ${c.bold}${project.name}${c.reset}`);
  console.log(`  ${c.gray}User: ${project.userId}${c.reset}\n`);

  try {
    // 2. Build, push to GitHub, deploy to Vercel — all in one step
    console.log(`  ${c.cyan}⟳${c.reset} Building, pushing to GitHub & deploying to Vercel...`);
    const result = await nextjsBuilder.buildAndDeploy(projectId, project.userId);

    // 3. Update statuses
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'PUBLISHED' },
    });
    await prisma.websiteData.update({
      where: { projectId },
      data: { generationStatus: 'completed', lastGeneratedAt: new Date() },
    });

    // 4. Show result
    console.log(`\n  ${c.green}✓${c.reset} Deployment complete!\n`);
    banner('Done! Your project is ready.');
    console.log(`\n  ${c.bold}Live URL: ${c.blue}${result.vercelUrl}${c.reset}`);
    console.log(`  ${c.bold}GitHub:  ${c.blue}${result.cloneUrl}${c.reset}\n`);
  } catch (error: any) {
    console.log(`\n  ${c.red}✗ Deploy failed: ${error.message}${c.reset}`);
    console.error(error.stack);
  }

  await app.close();
  process.exit(0);
}

main();
