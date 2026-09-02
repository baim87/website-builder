import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InterviewService } from '../src/interview/interview.service';
import { GenerationProducer } from '../src/queue/producers/generation.producer';
import { PrismaService } from '../src/prisma/prisma.service';
import { GooglePlacesService } from '../src/projects/google-places.service';
import { BUSINESS_FIELDS, BRAND_FIELDS } from '../src/interview/constants/interview-fields.constant';
import { BusinessContextService } from '../src/projects/business-context.service';
import { StorageService } from '../src/storage/storage.service';
import * as fs from 'fs';
import * as readline from 'readline';

// ==========================================
// TERMINAL STYLING
// ==========================================
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
};

const paint = (text: string, ...codes: string[]) => `${codes.join('')}${text}${c.reset}`;

const AI_LABEL = paint('AI', c.bold, c.cyan);
const YOU_LABEL = paint('You', c.bold, c.magenta);
const SYSTEM_LABEL = paint('System', c.bold, c.gray);

function hr(char = '─', len = 47, color = c.gray) {
  console.log(paint(char.repeat(len), color));
}

function banner(title: string) {
  const width = Math.max(title.length + 4, 45);
  console.log(paint('┌' + '─'.repeat(width) + '┐', c.cyan));
  console.log(
    paint('│', c.cyan) +
    paint(title.padStart((width + title.length) / 2).padEnd(width), c.bold, c.white) +
    paint('│', c.cyan),
  );
  console.log(paint('└' + '─'.repeat(width) + '┘', c.cyan));
}

function section(title: string) {
  console.log('\n' + paint(`▸ ${title}`, c.bold, c.yellow));
  hr('─', title.length + 4, c.dim ? c.gray : c.gray);
}

function say(message: string) {
  console.log(`${AI_LABEL}  ${message}`);
}

function ok(message: string) {
  console.log(paint(`  ✓ ${message}`, c.green));
}

function warn(message: string) {
  console.log(paint(`  … ${message}`, c.yellow));
}

function fail(message: string) {
  console.log(paint(`  ✗ ${message}`, c.red));
}

function info(message: string) {
  console.log(paint(`  ${message}`, c.gray));
}

// ==========================================
// SPINNER (simple, dependency-free)
// ==========================================
function startSpinner(label: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write('\x1b[?25l'); // hide cursor
  const timer = setInterval(() => {
    process.stdout.write(`\r${paint(frames[i], c.cyan)} ${label}`);
    i = (i + 1) % frames.length;
  }, 80);

  return (finalMessage?: string, isSuccess = true) => {
    clearInterval(timer);
    process.stdout.write('\r\x1b[K'); // clear line
    process.stdout.write('\x1b[?25h'); // show cursor
    if (finalMessage) {
      isSuccess ? ok(finalMessage) : fail(finalMessage);
    }
  };
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const interviewService = app.get(InterviewService);
  const generationProducer = app.get(GenerationProducer);
  const prisma = app.get(PrismaService);
  const googlePlacesService = app.get(GooglePlacesService);
  const businessContextService = app.get(BusinessContextService);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(paint(`${YOU_LABEL} ${query}`, c.reset) + paint(' ➜ ', c.dim), resolve));
  };

  console.clear();
  banner('Contractor Website Builder — AI Chat CLI');
  console.log();

  // 1. Setup Dummy User and Project
  const userEmail = 'cli-tester@example.com';
  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: 'CLI Tester',
      },
    });
  }

  const existingProjects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  let project;

  if (existingProjects.length > 0) {
    console.log('\nExisting Projects:');
    existingProjects.forEach((p, idx) => {
      console.log(`  ${paint(`${idx + 1})`, c.cyan, c.bold)} ${p.name} ${paint(`(${p.id})`, c.gray)}`);
    });
    console.log(`  ${paint('0)', c.gray)} ${paint('Create a new project', c.gray)}\n`);
    
    const choice = await question('Select a project to resume, or 0 to create new:');
    const choiceNum = parseInt(choice, 10);
    if (!isNaN(choiceNum) && choiceNum > 0 && choiceNum <= existingProjects.length) {
       project = existingProjects[choiceNum - 1];
       ok(`Resuming project — ${paint(project.name, c.bold)} ${paint(`(${project.id})`, c.dim)}`);
    }
  }

  if (!project) {
    const projectName = await question('Enter a name for your new project:');
    project = await prisma.project.create({
      data: {
        userId: user.id,
        name: projectName || 'Test Project',
        status: 'draft',
      },
    });

    await prisma.businessContext.create({
      data: {
        projectId: project.id,
      },
    });

    ok(`Project created — ${paint(project.name, c.bold)} ${paint(`(${project.id})`, c.dim)}`);
  }
  
  info('Tip: type "exit" or "quit" at any prompt to stop.');

  // ==========================================
  // STATE 1: GMB Check
  // ==========================================
  section('Google Business Profile');
  const existingContext = await businessContextService.findByProjectId(project.id).catch(() => null);
  
  if (!existingContext || !existingContext.businessName) {
    const gmbInput = await question('Got a Google Business Profile URL, or Business Name + City? (or type "no"):');

    if (gmbInput.toLowerCase() !== 'no' && gmbInput.trim() !== '') {
      const stopSpinner = startSpinner('Searching Google Business Profiles...');
      const scrapedResults = await googlePlacesService.scrapeGoogleBusinessProfile(gmbInput);

      if (scrapedResults && scrapedResults.length > 0) {
        stopSpinner(`Found ${scrapedResults.length} matching business(es)`);
        console.log();

        scrapedResults.forEach((res: any, idx: number) => {
          console.log(`  ${paint(`${idx + 1})`, c.cyan, c.bold)} ${res.businessName} ${paint(`— ${res.businessAddress}`, c.gray)}`);
        });
        console.log(`  ${paint('0)', c.gray)} ${paint('None of these, let\'s do it manually', c.gray)}`);
        console.log();

        const selection = await question('Select a number:');
        const selNum = parseInt(selection, 10);

        if (!isNaN(selNum) && selNum > 0 && selNum <= scrapedResults.length) {
          const chosenData = scrapedResults[selNum - 1];
          await businessContextService.upsert(project.id, chosenData);
          ok('Saved these details to your profile:');
          for (const [k, v] of Object.entries(chosenData)) {
            if (v) {
              const displayValue = typeof v === 'object' ? JSON.stringify(v) : v;
              console.log(`    ${paint(k, c.blue)}: ${displayValue}`);
            }
          }
        } else {
          warn("No problem — we'll do it manually!");
        }
      } else {
        stopSpinner("No matches found — we'll do it manually", false);
      }
    }
  } else {
    ok(`Found existing business: ${existingContext.businessName}`);
  }

  // ==========================================
  // STATE 2: Business Interview Loop
  // ==========================================
  section('Business Details');
  say("Let's get your business details squared away.");
  let firstBusinessQuestion = true;

  while (true) {
    const status = await interviewService.checkCompleteness(project.id, BUSINESS_FIELDS);

    let userInput = '';
    if (firstBusinessQuestion) {
      // Jump-start the conversation without requiring the user to speak first
      userInput = "Let's start.";
      firstBusinessQuestion = false;
    } else if (status.complete) {
      if (userInput === '') {
        const context = await businessContextService.findByProjectId(project.id);
        console.log(paint('\nBusiness Details captured so far:', c.cyan, c.bold));
        for (const field of BUSINESS_FIELDS) {
           console.log(`  ${paint(field, c.blue)}: ${JSON.stringify((context as any)[field] || '')}`);
        }
      }
      userInput = await question('\nIs this solid? Press Enter to continue to Brand Details, or type adjustments you want to make: ');
      if (userInput.trim() === '') break;
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') process.exit(0);
    } else {
      userInput = await question('');
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') process.exit(0);
      if (!userInput.trim()) continue;
    }

    process.stdout.write(`${AI_LABEL}  `);
    const stream = interviewService.processMessage(project.id, userInput, status.missingFields);

    for await (const event of stream) {
      if (event.event === 'token') {
        process.stdout.write(event.data.token || '');
      } else if (event.event === 'field-update') {
        process.stdout.write(paint(`\n  ↳ [${SYSTEM_LABEL}] extracted ${event.data.field} = ${JSON.stringify(event.data.value)}`, c.dim) + ' ');
      } else if (event.event === 'done') {
        console.log('\n');
      } else if (event.event === 'error') {
        fail(`${event.data.message}\n`);
      }
    }
  }

  // ==========================================
  // STATE 3: Logo Check
  // ==========================================
  section('Brand Assets');
  const existingAssets = await prisma.asset.findFirst({ where: { projectId: project.id, purpose: 'logo' } });
  
  if (!existingAssets) {
    const logoInput = await question("Got an existing logo you'd like to use? (path/URL, or type \"no\"):");
    if (logoInput.toLowerCase() !== 'no' && logoInput.trim() !== '') {
      try {
        say(`Fetching and uploading logo to R2...`);
        const storageService = app.get(StorageService);
        let buffer: Buffer;
        let mimeType = 'image/png';
        
        if (logoInput.startsWith('http://') || logoInput.startsWith('https://')) {
          const axios = require('axios');
          const res = await axios.get(logoInput, { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
          });
          buffer = Buffer.from(res.data);
          mimeType = res.headers['content-type'] || mimeType;
        } else {
          buffer = fs.readFileSync(logoInput);
          if (logoInput.endsWith('.jpg') || logoInput.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (logoInput.endsWith('.webp')) mimeType = 'image/webp';
          else if (logoInput.endsWith('.svg')) mimeType = 'image/svg+xml';
        }

        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        const key = `projects/${project.id}/assets/${hash}-logo`;
        const uploadedUrl = await storageService.upload(key, buffer, mimeType);

        await prisma.asset.create({
          data: {
            projectId: project.id,
            url: uploadedUrl,
            type: 'image',
            purpose: 'logo',
            section: 'header,footer',
          },
        });
        ok(`Logo uploaded and saved to R2 successfully!`);
      } catch (e: any) {
        fail(`Failed to upload logo: ${e.message}`);
      }
    }
  } else {
    ok(`Found existing logo asset.`);
  }

  // ==========================================
  // STATE 4: Brand Interview Loop
  // ==========================================
  say("Now let's figure out your brand colors and style.");
  let firstBrandQuestion = true;
  while (true) {
    const status = await interviewService.checkCompleteness(project.id, BRAND_FIELDS);

    let userInput = '';
    if (firstBrandQuestion) {
      userInput = "Let's figure out my brand colors and style.";
      firstBrandQuestion = false;
    } else if (status.complete) {
      if (userInput === '') {
        const context = await businessContextService.findByProjectId(project.id);
        console.log(paint('\nBrand Details captured so far:', c.cyan, c.bold));
        for (const field of BRAND_FIELDS) {
           console.log(`  ${paint(field, c.blue)}: ${JSON.stringify((context as any)[field] || '')}`);
        }
      }
      userInput = await question('\nIs this solid? Press Enter to generate your website, or type adjustments you want to make: ');
      if (userInput.trim() === '') break;
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') process.exit(0);
    } else {
      userInput = await question('');
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') process.exit(0);
      if (!userInput.trim()) continue;
    }

    process.stdout.write(`${AI_LABEL}  `);
    const stream = interviewService.processMessage(project.id, userInput, status.missingFields);

    for await (const event of stream) {
      if (event.event === 'token') {
        process.stdout.write(event.data.token || '');
      } else if (event.event === 'field-update') {
        process.stdout.write(paint(`\n  ↳ [${SYSTEM_LABEL}] extracted ${event.data.field} = ${JSON.stringify(event.data.value)}`, c.dim) + ' ');
      } else if (event.event === 'done') {
        console.log('\n');
      } else if (event.event === 'error') {
        fail(`${event.data.message}\n`);
      }
    }
  }

  // ==========================================
  // STATE 5: Generation
  // ==========================================
  section('Website Generation');
  console.log(paint('Triggering website generation pipeline... This will take 1-2 minutes.', c.cyan));
  app.useLogger(['log', 'warn', 'error']); // Enable logs so user can see progress

  try {
    await generationProducer.generateSite(project.id);
    
    let isFinished = false;
    let liveUrl = null;
    let finalStatus = 'generating';
    
    const stopSpinner = startSpinner('Generating website in the background...');

    while (!isFinished) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Poll every 3s
      const websiteData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
      const projectData = await prisma.project.findUnique({ where: { id: project.id }, include: { domain: true } });
      
      if (websiteData && (websiteData.generationStatus === 'completed' || websiteData.generationStatus === 'failed')) {
        isFinished = true;
        finalStatus = websiteData.generationStatus;
        if (finalStatus === 'completed') {
            if (projectData?.domain?.domainName) {
              liveUrl = `https://${projectData.domain.domainName}`;
            } else {
              // Build the vercel.app URL from the business name, matching NextjsBuilderService logic
              const ctx = await businessContextService.findByProjectId(project.id).catch(() => null);
              const slug = ctx?.businessName
                ? ctx.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
                : `project-${project.id.substring(0, 8)}`;
              const repoName = `${slug}-${project.id.substring(0, 4)}`;
              liveUrl = `https://${repoName}.vercel.app`;
            }
        }
      }
    }
    
    stopSpinner('', finalStatus === 'completed');

    console.log();
    ok(`Generation complete — status: ${paint(finalStatus, c.bold, finalStatus === 'completed' ? c.green : c.red)}`);
    console.log();
    banner('Done! Your project is ready.');
    if (liveUrl && finalStatus === 'completed') {
      console.log(`\n  Live URL: ${paint(liveUrl, c.bold, c.blue, c.reset)}`);
      console.log(`  (Note: It might take a minute for the DNS to propagate)`);
    }
  } catch (error) {
    fail('Failed to enqueue generation job');
    console.error(paint(String(error), c.red));
  }

  console.log();
  rl.close();
  await app.close();
  process.exit(0);
}

bootstrap();