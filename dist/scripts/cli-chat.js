"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const interview_service_1 = require("../src/interview/interview.service");
const generation_service_1 = require("../src/generation/generation.service");
const prisma_service_1 = require("../src/prisma/prisma.service");
const google_places_service_1 = require("../src/projects/google-places.service");
const interview_fields_constant_1 = require("../src/interview/constants/interview-fields.constant");
const business_context_service_1 = require("../src/projects/business-context.service");
const readline = __importStar(require("readline"));
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
const paint = (text, ...codes) => `${codes.join('')}${text}${c.reset}`;
const AI_LABEL = paint('AI', c.bold, c.cyan);
const YOU_LABEL = paint('You', c.bold, c.magenta);
const SYSTEM_LABEL = paint('System', c.bold, c.gray);
function hr(char = '─', len = 47, color = c.gray) {
    console.log(paint(char.repeat(len), color));
}
function banner(title) {
    const width = Math.max(title.length + 4, 45);
    console.log(paint('┌' + '─'.repeat(width) + '┐', c.cyan));
    console.log(paint('│', c.cyan) +
        paint(title.padStart((width + title.length) / 2).padEnd(width), c.bold, c.white) +
        paint('│', c.cyan));
    console.log(paint('└' + '─'.repeat(width) + '┘', c.cyan));
}
function section(title) {
    console.log('\n' + paint(`▸ ${title}`, c.bold, c.yellow));
    hr('─', title.length + 4, c.dim ? c.gray : c.gray);
}
function say(message) {
    console.log(`${AI_LABEL}  ${message}`);
}
function ok(message) {
    console.log(paint(`  ✓ ${message}`, c.green));
}
function warn(message) {
    console.log(paint(`  … ${message}`, c.yellow));
}
function fail(message) {
    console.log(paint(`  ✗ ${message}`, c.red));
}
function info(message) {
    console.log(paint(`  ${message}`, c.gray));
}
function startSpinner(label) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write('\x1b[?25l');
    const timer = setInterval(() => {
        process.stdout.write(`\r${paint(frames[i], c.cyan)} ${label}`);
        i = (i + 1) % frames.length;
    }, 80);
    return (finalMessage, isSuccess = true) => {
        clearInterval(timer);
        process.stdout.write('\r\x1b[K');
        process.stdout.write('\x1b[?25h');
        if (finalMessage) {
            isSuccess ? ok(finalMessage) : fail(finalMessage);
        }
    };
}
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn'] });
    const interviewService = app.get(interview_service_1.InterviewService);
    const generationService = app.get(generation_service_1.GenerationService);
    const prisma = app.get(prisma_service_1.PrismaService);
    const googlePlacesService = app.get(google_places_service_1.GooglePlacesService);
    const businessContextService = app.get(business_context_service_1.BusinessContextService);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = (query) => {
        return new Promise((resolve) => rl.question(paint(`${YOU_LABEL} ${query}`, c.reset) + paint(' ➜ ', c.dim), resolve));
    };
    console.clear();
    banner('Contractor Website Builder — AI Chat CLI');
    console.log();
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
    const projectName = await question('Enter a name for your new project:');
    const project = await prisma.project.create({
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
    info('Tip: type "exit" or "quit" at any prompt to stop.');
    section('Google Business Profile');
    const gmbInput = await question('Got a Google Business Profile URL, or Business Name + City? (or type "no"):');
    if (gmbInput.toLowerCase() !== 'no' && gmbInput.trim() !== '') {
        const stopSpinner = startSpinner('Searching Google Business Profiles...');
        const scrapedResults = await googlePlacesService.scrapeGoogleBusinessProfile(gmbInput);
        if (scrapedResults && scrapedResults.length > 0) {
            stopSpinner(`Found ${scrapedResults.length} matching business(es)`);
            console.log();
            scrapedResults.forEach((res, idx) => {
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
            }
            else {
                warn("No problem — we'll do it manually!");
            }
        }
        else {
            stopSpinner("No matches found — we'll do it manually", false);
        }
    }
    section('Business Details');
    say("Let's get your business details squared away.");
    let firstBusinessQuestion = true;
    while (true) {
        const status = await interviewService.checkCompleteness(project.id, interview_fields_constant_1.BUSINESS_FIELDS);
        if (status.complete) {
            ok('All required business information captured!');
            break;
        }
        let userInput = '';
        if (firstBusinessQuestion) {
            userInput = "Let's start.";
            firstBusinessQuestion = false;
        }
        else {
            userInput = await question('');
            if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit')
                process.exit(0);
            if (!userInput.trim())
                continue;
        }
        process.stdout.write(`${AI_LABEL}  `);
        const stream = interviewService.processMessage(project.id, userInput, status.missingFields);
        for await (const event of stream) {
            if (event.event === 'token') {
                process.stdout.write(event.data.token || '');
            }
            else if (event.event === 'field-update') {
                process.stdout.write(paint(`\n  ↳ [${SYSTEM_LABEL}] extracted ${event.data.field} = ${JSON.stringify(event.data.value)}`, c.dim) + ' ');
            }
            else if (event.event === 'done') {
                console.log('\n');
            }
            else if (event.event === 'error') {
                fail(`${event.data.message}\n`);
            }
        }
    }
    section('Brand Assets');
    const logoInput = await question("Got an existing logo you'd like to use? (path/URL, or type \"no\"):");
    if (logoInput.toLowerCase() !== 'no' && logoInput.trim() !== '') {
        await prisma.asset.create({
            data: {
                projectId: project.id,
                url: logoInput,
                type: 'image',
                purpose: 'logo',
            },
        });
        ok(`Logo saved from: ${paint(logoInput, c.blue)}`);
    }
    say("Now let's figure out your brand colors and style.");
    let firstBrandQuestion = true;
    while (true) {
        const status = await interviewService.checkCompleteness(project.id, interview_fields_constant_1.BRAND_FIELDS);
        if (status.complete) {
            ok('All required brand information captured!');
            break;
        }
        let userInput = '';
        if (firstBrandQuestion) {
            userInput = "Let's figure out my brand colors and style.";
            firstBrandQuestion = false;
        }
        else {
            userInput = await question('');
            if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit')
                process.exit(0);
            if (!userInput.trim())
                continue;
        }
        process.stdout.write(`${AI_LABEL}  `);
        const stream = interviewService.processMessage(project.id, userInput, status.missingFields);
        for await (const event of stream) {
            if (event.event === 'token') {
                process.stdout.write(event.data.token || '');
            }
            else if (event.event === 'field-update') {
                process.stdout.write(paint(`\n  ↳ [${SYSTEM_LABEL}] extracted ${event.data.field} = ${JSON.stringify(event.data.value)}`, c.dim) + ' ');
            }
            else if (event.event === 'done') {
                console.log('\n');
            }
            else if (event.event === 'error') {
                fail(`${event.data.message}\n`);
            }
        }
    }
    section('Website Generation');
    console.log(paint('Triggering website generation pipeline... This will take 1-2 minutes.', c.cyan));
    app.useLogger(['log', 'warn', 'error']);
    try {
        const liveUrl = await generationService.generateProject(project.id);
        const websiteData = await prisma.websiteData.findUnique({ where: { projectId: project.id } });
        console.log();
        ok(`Generation complete — status: ${paint(websiteData?.generationStatus ?? 'unknown', c.bold, c.green)}`);
        console.log();
        banner('Done! Your project is ready.');
        if (liveUrl) {
            console.log(`\n  Live URL: ${paint(liveUrl, c.bold, c.blue, c.reset)}`);
            console.log(`  (Note: It might take a minute for the DNS to propagate)`);
        }
    }
    catch (error) {
        fail('Generation failed');
        console.error(paint(String(error), c.red));
    }
    console.log();
    rl.close();
    await app.close();
    process.exit(0);
}
bootstrap();
//# sourceMappingURL=cli-chat.js.map