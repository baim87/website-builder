process.env.APP_MODE = "api";

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InterviewService } from '../src/interview/interview.service';
import { GenerationProducer } from '../src/queue/producers/generation.producer';
import { PrismaService } from '../src/prisma/prisma.service';
import { GooglePlacesService } from '../src/projects/google-places.service';
import { BUSINESS_FIELDS } from '../src/interview/constants/interview-fields.constant';
import { BusinessContextService } from '../src/projects/business-context.service';

import { LogoGenerationService } from '../src/assets/logo-generation.service';
import { BrandExtractionService } from '../src/assets/brand-extraction.service';
import { BrandKitGeneratorSkill } from '../src/skills/impl/brand-kit-generator.skill';
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
  const cols = process.stdout.columns || 80;
  const maxLabel = cols - 4; // frame char + spaces
  const truncated = label.length > maxLabel ? label.substring(0, maxLabel - 1) + '…' : label;
  const timer = setInterval(() => {
    process.stdout.write(`\r\x1b[K${paint(frames[i], c.cyan)} ${truncated}`);
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
  // Prevent CLI from starting its own background workers and stealing jobs from Docker
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const interviewService = app.get(InterviewService);
  const generationProducer = app.get(GenerationProducer);
  const prisma = app.get(PrismaService);
  const googlePlacesService = app.get(GooglePlacesService);
  const businessContextService = app.get(BusinessContextService);
  const brandExtractionService = app.get(BrandExtractionService);
  const brandKitGenerator = app.get(BrandKitGeneratorSkill);

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
  // STATE 3: Brand & Assets
  // ==========================================
  section('Brand & Assets');
  
  const existingBrandContext = await businessContextService.findByProjectId(project.id).catch(() => null);
  const existingLogo = await prisma.asset.findFirst({ where: { projectId: project.id, purpose: 'logo' } });

  if (!existingBrandContext?.brandIdentityInputs || !existingLogo) {
    say("Do you already have a brand for " + (existingBrandContext?.businessName || "this business") + "?");
    console.log(`  ${paint('A)', c.cyan, c.bold)} Yes, I have a brand & logo`);
    console.log(`  ${paint('B)', c.cyan, c.bold)} Yes, I have a brand but no logo`);
    console.log(`  ${paint('C)', c.cyan, c.bold)} No, create everything from scratch\n`);
    
    let brandChoice = '';
    while (['a', 'b', 'c'].indexOf(brandChoice.toLowerCase()) === -1) {
      brandChoice = await question('Select A, B, or C:');
    }
    
    const brandAnswers: Record<string, string> = {};
    let extractedBrand: any = null;
    
    // --- BRANCH A: Has Brand & Logo ---
    if (brandChoice.toLowerCase() === 'a') {
      const logoInput = await question("Awesome. Please provide the path or URL to your logo:");
      let uploadedLogoBuffer: Buffer | null = null;
      if (logoInput.trim() !== '') {
        try {
          say(`Fetching and uploading logo to R2...`);
          const ingestionService = app.get(require('../src/assets/brand-asset-ingestion.service').BrandAssetIngestionService);
          const result = await ingestionService.processAsset(project.id, user.id, 'logo', logoInput.trim());
          uploadedLogoBuffer = result.buffer;
          ok(`Logo uploaded successfully!`);
          
          say(`Analyzing logo to extract brand colors and fonts...`);
          extractedBrand = await brandExtractionService.extractBrandFromLogo(result.url);
          ok(`Extracted Primary Color: ${extractedBrand.colors.primary}, Fonts: ${extractedBrand.typography.headingFont}`);
          
          const faviconInput = await question("Do you have a specific 32x32 Favicon? (Provide path/URL, or type 'no' to auto-generate):");
          if (faviconInput.toLowerCase() !== 'no' && faviconInput.trim() !== '') {
            say(`Uploading custom favicon...`);
            await ingestionService.processAsset(project.id, user.id, 'favicon', faviconInput.trim());
            ok(`Custom favicon uploaded successfully!`);
          } else if (uploadedLogoBuffer) {
            say(`Auto-generating favicon from logo...`);
            await ingestionService.deriveFaviconFromLogo(project.id, user.id, uploadedLogoBuffer);
            ok(`Favicon auto-generated successfully!`);
          }
        } catch (e: any) {
          fail(`Failed to process brand assets: ${e.message}`);
        }
      }

      say("To wrap up your brand profile:");
      const questions = [
        "Do you have a slogan, and how would you describe your brand's personality, positioning, and target audience? (Or type 'skip')",
        "How would you describe your services, materials used, and key benefits? (Or type 'skip')",
        "What is the visual mood of your brand — lighting style, textures, atmosphere? (Or type 'skip')"
      ];
      for (let i = 0; i < questions.length; i++) {
        brandAnswers[`q${i+1}`] = await question(`[${i+1}/${questions.length}] ${questions[i]}`);
      }

      if (extractedBrand) {
        brandAnswers['primaryColor'] = extractedBrand.colors.primary;
        brandAnswers['secondaryColor'] = extractedBrand.colors.secondary;
        brandAnswers['accentColor'] = extractedBrand.colors.accent;
        brandAnswers['headingFont'] = extractedBrand.typography.headingFont;
        brandAnswers['bodyFont'] = extractedBrand.typography.bodyFont;
      }
    } 
    // --- BRANCH B: Has Brand, No Logo ---
    else if (brandChoice.toLowerCase() === 'b') {
      say("Great. Let's capture your brand details and generate a logo for you.");
      const questions = [
        "Do you have a slogan, and how would you describe your brand's personality and target audience?",
        "What are your brand's color palette and typography/font preferences? (Share hex codes if you have them)",
        "How would you describe your services, materials used, and key benefits?",
        "What is the visual mood of your brand — lighting style, textures, atmosphere?"
      ];
      for (let i = 0; i < questions.length; i++) {
        brandAnswers[`q${i+1}`] = await question(`[${i+1}/${questions.length}] ${questions[i]}`);
      }
      
      const stopLogoSpinner = startSpinner('Generating AI vector logo...');
      try {
        const bName = existingBrandContext?.businessName || 'the business';
        const trade = existingBrandContext?.trade || 'contractor';
        const logoGenerationService = app.get(LogoGenerationService);
        const uploadedLogoUrl = await logoGenerationService.generateLogoAndFavicon(project.id, bName, trade, JSON.stringify(brandAnswers));
        stopLogoSpinner('', true);
        ok(`AI Logo generated and uploaded to R2 successfully: ${uploadedLogoUrl}`);
      } catch (e: any) {
        stopLogoSpinner('', false);
        fail(`Failed to generate AI logo: ${e.message}`);
      }
    } 
    // --- BRANCH C: No Brand ---
    else {
      say("No problem! Let's build a premium brand from scratch.");
      const stylePrompt = await question("What general visual style, color palette, or mood do you want? (e.g. 'dark & cinematic with gold accents', or 'clean minimal blues'):");
      
      const stopBrandSpinner = startSpinner('Generating 13-point Brand Kit...');
      try {
        const brandKitResult = await brandKitGenerator.execute({
          projectId: project.id,
          context: { businessContext: existingBrandContext, stylePrompt },
          metadata: { phase: 'pre-generation' }
        });
        
        stopBrandSpinner('', true);
        ok("Comprehensive Brand Kit generated successfully!");
        
        const kit = brandKitResult.data;
        Object.assign(brandAnswers, kit);
        
        console.log(paint(`\n  Brand Name: ${kit.brandName}`, c.dim));
        console.log(paint(`  Slogan: ${kit.slogan}`, c.dim));
        console.log(paint(`  Colors: ${kit.colors.primary} (Primary), ${kit.colors.secondary} (Secondary)`, c.dim));
        console.log(paint(`  Logo Direction: ${kit.logoDirection}\n`, c.dim));

        const stopLogoSpinner = startSpinner('Generating AI logo from Brand Kit...');
        const bName = kit.brandName || existingBrandContext?.businessName || 'the business';
        const trade = existingBrandContext?.trade || 'contractor';
        const logoGenerationService = app.get(LogoGenerationService);
        const uploadedLogoUrl = await logoGenerationService.generateLogoAndFavicon(project.id, bName, trade, kit.logoDirection + " " + JSON.stringify(kit.colors));
        stopLogoSpinner('', true);
        ok(`AI Logo generated and uploaded to R2 successfully: ${uploadedLogoUrl}`);

      } catch (e: any) {
        stopBrandSpinner('', false);
        fail(`Failed to generate Brand Kit: ${e.message}`);
      }
    }

    say("Finally, which design theme would you prefer for your website?");
    console.log(`  ${paint('1)', c.cyan, c.bold)} Editorial Luxury (Earthy, Magazine-style)`);
    console.log(`  ${paint('2)', c.cyan, c.bold)} Modern Minimalist (Crisp, High Contrast)`);
    console.log(`  ${paint('3)', c.cyan, c.bold)} Soft & Organic (Rounded, Warm)`);
    console.log(`  ${paint('4)', c.cyan, c.bold)} Dark Bento (Dark Mode, Structured)`);
    console.log(`  ${paint('5)', c.cyan, c.bold)} Awesomic (Technical Marketplace)`);
    console.log(`  ${paint('6)', c.cyan, c.bold)} Mercury (Alpine Banking)`);
    console.log(`  ${paint('7)', c.cyan, c.bold)} Hyer Aviation (Luxury Travel Editorial)`);
    console.log(`  ${paint('8)', c.cyan, c.bold)} Superpower (Cinematic Health Tech)`);
    console.log(`  ${paint('9)', c.cyan, c.bold)} 11x (Cinematic Editorial Serif)`);
    console.log();
    
    let themeChoice = '';
    while (true) {
      const selection = await question('Select a number (1-9):');
      const selNum = parseInt(selection, 10);
      if (selNum === 1) { themeChoice = 'editorial-luxury'; break; }
      if (selNum === 2) { themeChoice = 'modern-minimalist'; break; }
      if (selNum === 3) { themeChoice = 'soft-organic'; break; }
      if (selNum === 4) { themeChoice = 'dark-bento'; break; }
      if (selNum === 5) { themeChoice = 'awesomic'; break; }
      if (selNum === 6) { themeChoice = 'mercury'; break; }
      if (selNum === 7) { themeChoice = 'hyer-aviation'; break; }
      if (selNum === 8) { themeChoice = 'superpower'; break; }
      if (selNum === 9) { themeChoice = '11x-editorial'; break; }
      warn("Please enter a valid number (1-9).");
    }
    brandAnswers['themePreference'] = themeChoice;

    // Save to brandIdentityInputs for all branches
    await prisma.businessContext.update({
      where: { projectId: project.id },
      data: { brandIdentityInputs: brandAnswers }
    });
    ok("Brand Identity Context saved to database.");
  } else {
    ok("Found existing brand identity inputs and logo asset.");
  }

  // ==========================================
  // STATE 4.5: Owner Portrait Check
  // ==========================================
  section('Owner Portrait');
  const existingPortrait = await prisma.asset.findFirst({ where: { projectId: project.id, purpose: 'portrait' } });
  const finalContext = await businessContextService.findByProjectId(project.id).catch(() => null);
  
  if (!existingPortrait && finalContext?.contactPerson) {
    say(`We noticed ${finalContext.contactPerson} is listed as the main contact person.`);
    const portraitInput = await question(`Got a photo of them to generate a professional portrait for the About section? (path to file, or type "no"):`);
    
    if (portraitInput.toLowerCase() !== 'no' && portraitInput.trim() !== '') {
      try {
        const stopPortraitSpinner = startSpinner('Generating professional portrait...');
        
        const portraitGenerationService = app.get(require('../src/assets/portrait-generation.service').PortraitGenerationService);
        const trade = finalContext?.trade || 'contractor';
        
        const uploadedPortraitUrl = await portraitGenerationService.generatePortrait(project.id, trade, portraitInput.trim());
        
        stopPortraitSpinner('', true);
        ok(`AI Portrait generated and uploaded to R2 successfully!`);
        console.log(`  Live Asset URL: ${paint(uploadedPortraitUrl, c.blue, c.dim)}`);
      } catch (e: any) {
        fail(`Failed to generate AI portrait: ${e.message}`);
      }
    }
  } else if (existingPortrait) {
    ok(`Found existing portrait asset.`);
  }

  // ==========================================
  // STATE 5: Generation
  // ==========================================
  section('Website Generation');
  app.useLogger(['log', 'warn', 'error']); // Enable logs so user can see progress

  try {
    const existingData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
    
    // Only trigger if it hasn't been generated yet or explicitly failed
    if (!existingData || existingData.generationStatus === 'failed') {
      console.log(paint('Triggering website generation pipeline... This will take 1-2 minutes.', c.cyan));
      await generationProducer.generateSite(project.id, user.id);
    } else {
      console.log(paint(`Resuming tracking for existing generation (Status: ${existingData.generationStatus})...`, c.cyan));
    }
    
    let isFinished = false;
    let liveUrl = null;
    let finalStatus = existingData?.generationStatus || 'generating';
    
    const stopSpinner = startSpinner('Generating website in the background...');

    while (!isFinished) {
      if (finalStatus === 'completed' || finalStatus === 'failed') {
        isFinished = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Poll every 3s
      }
      const websiteData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
      const projectData = await prisma.project.findUnique({ where: { id: project.id }, include: { domain: true } });
      
      if (websiteData && (websiteData.generationStatus === 'completed' || websiteData.generationStatus === 'failed')) {
        isFinished = true;
        finalStatus = websiteData.generationStatus;
        if (finalStatus === 'completed') {
            if (projectData?.domain?.domainName) {
              liveUrl = `https://${projectData.domain.domainName}`;
            } else {
              const ctx = await businessContextService.findByProjectId(project.id).catch(() => null);
              const slug = ctx?.businessName
                ? ctx.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
                : `project-${project.id.substring(0, 8)}`;
              const repoName = `${slug}-${project.id.substring(0, 4)}`;
              
              // Instead of assuming the URL, fetch it from Vercel's API
              try {
                const vercelClient = app.get(require('../src/vercel/vercel.client').VercelClient);
                const deployRes = await vercelClient.getProjectDeployments(repoName);
                if (deployRes && deployRes.deployments && deployRes.deployments.length > 0) {
                  const latestDeploy = deployRes.deployments[0];
                  if (latestDeploy.url) {
                    liveUrl = `https://${latestDeploy.url}`;
                  }
                }
              } catch (e) {
                // Ignore fallback to generic
              }
              
              if (!liveUrl) {
                liveUrl = `https://${repoName}.vercel.app`;
              }
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
      console.log(`  (Note: It might take a minute for the DNS to propagate)\n`);
      
      const imageSpinner = startSpinner('Waiting for image generation...');
      let imagesFinished = false;
      while (!imagesFinished) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const pendingAssets = await prisma.projectAsset.count({ 
          where: { projectId: project.id, status: { in: ['pending', 'generating'] } } 
        });
        if (pendingAssets === 0) {
          imagesFinished = true;
        }
      }
      imageSpinner('Images generated successfully!', true);
      
      const stopQcSpinner = startSpinner('Running Quality Control...');
      
      let qcFinished = false;
      let finalQcStatus = 'standby';
      let qcReport: any = null;

      // Manually trigger QC if we skipped generation but QC hasn't run yet
      const currentWebsiteData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
      if (currentWebsiteData && currentWebsiteData.qcStatus === 'standby' && liveUrl) {
         const ctx = await businessContextService.findByProjectId(project.id).catch(() => null);
         const businessName = ctx?.businessName || 'service business';
         const qcProducer = app.get(require('../src/queue/producers/quality-control.producer').QualityControlProducer);
         await qcProducer.triggerQualityControl(project.id, user.id, liveUrl, businessName);
      }

      while (!qcFinished) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        const websiteData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
        
        if (websiteData && (websiteData.qcStatus === 'passed' || websiteData.qcStatus === 'failed')) {
          qcFinished = true;
          finalQcStatus = websiteData.qcStatus;
          qcReport = websiteData.qcReport;
        }
      }

      stopQcSpinner('', true);

      if (finalQcStatus === 'passed') {
        console.log();
        ok(paint('Quality Control PASSED ✓ All visual & performance checks look great.', c.green, c.bold));
      } else if (finalQcStatus === 'failed' && qcReport) {
        console.log();
        const hrStr = '══════════════════════════════════════════════════';
        console.log(paint(`╔${hrStr}╗`, c.red));
        console.log(paint(`║     QC AUTO-REPAIR FAILED — MANUAL FIX NEEDED   ║`, c.red, c.bold));
        console.log(paint(`╠${hrStr}╣`, c.red));
        console.log(paint(`║ Project: ${project.id.padEnd(39)}║`, c.red));
        console.log(paint(`║ Attempts: 3/3                                    ║`, c.red));
        console.log(paint(`╠${hrStr}╣`, c.red));
        console.log(paint(`║                                                  ║`, c.red));
        console.log(paint(`║ UNRESOLVED ISSUES:                               ║`, c.red));
        console.log(paint(`║                                                  ║`, c.red));
        
        // Render visual issues
        if (qcReport.visualCritiques) {
          const pageMap = new Map<string, any[]>();
          for (const vCritique of qcReport.visualCritiques) {
            if (!pageMap.has(vCritique.pageUrl)) pageMap.set(vCritique.pageUrl, []);
            for (const comp of vCritique.issues) {
              if (comp.issues.length > 0) {
                pageMap.get(vCritique.pageUrl)!.push(comp);
              }
            }
          }

          for (const [pageUrl, components] of pageMap.entries()) {
            if (components.length === 0) continue;
            
            const path = new URL(pageUrl).pathname;
            console.log(paint(`║ Page: ${path.padEnd(43)}║`, c.red, c.bold));
            
            for (let i = 0; i < components.length; i++) {
              const comp = components[i];
              const isLastComp = i === components.length - 1;
              console.log(paint(`║   ${isLastComp ? '└─' : '├─'} ${comp.componentName.padEnd(38)}║`, c.red));
              
              for (const issue of comp.issues) {
                const truncated = issue.length > 40 ? issue.substring(0, 37) + '...' : issue;
                console.log(paint(`║       • ${truncated.padEnd(41)}║`, c.red));
              }
            }
            console.log(paint(`║                                                  ║`, c.red));
          }
        }
        
        // Render performance issues
        if (qcReport.lighthouseReports) {
          const perfIssues = qcReport.lighthouseReports.filter((r: any) => r.performance < 90);
          if (perfIssues.length > 0) {
            console.log(paint(`║ PERFORMANCE:                                     ║`, c.red, c.bold));
            for (const r of perfIssues) {
              const path = new URL(r.url).pathname;
              console.log(paint(`║   • ${path}: ${r.performance}/100 (${r.strategy})`.padEnd(49) + `║`, c.red));
            }
            console.log(paint(`║                                                  ║`, c.red));
          }
        }

        console.log(paint(`╚${hrStr}╝`, c.red));
      }
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