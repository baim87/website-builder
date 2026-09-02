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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NextjsBuilderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextjsBuilderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const business_context_service_1 = require("../projects/business-context.service");
const website_data_service_1 = require("../projects/website-data.service");
const page_service_1 = require("../projects/page.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let NextjsBuilderService = NextjsBuilderService_1 = class NextjsBuilderService {
    configService;
    businessContextService;
    websiteDataService;
    pageService;
    logger = new common_1.Logger(NextjsBuilderService_1.name);
    constructor(configService, businessContextService, websiteDataService, pageService) {
        this.configService = configService;
        this.businessContextService = businessContextService;
        this.websiteDataService = websiteDataService;
        this.pageService = pageService;
    }
    async buildAndDeploy(projectId, userId) {
        this.logger.log(`Starting Next.js build and deploy for project ${projectId}`);
        const businessContext = await this.businessContextService.findByProjectId(projectId, userId);
        const tempId = crypto.randomUUID();
        const tempDir = path.join('/tmp', `builder-${tempId}`);
        const isDocker = process.env.NODE_ENV === 'production';
        const templateDir = isDocker
            ? path.join(process.cwd(), '../site-template')
            : path.join(process.cwd(), '../site-template');
        try {
            this.logger.log(`Cloning template from ${templateDir} to ${tempDir}`);
            await fs.mkdir(tempDir, { recursive: true });
            await execAsync(`rsync -a --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'dist' ${templateDir}/ ${tempDir}/`);
            const componentsDir = path.join(tempDir, 'src/components');
            const backupDir = path.join(tempDir, 'src/components_backup');
            await execAsync(`cp -R ${componentsDir} ${backupDir}`);
            const websiteData = await this.websiteDataService.findByProjectId(projectId);
            const pages = await this.pageService.getPagesByProjectId(projectId);
            const designTokens = websiteData?.designTokens;
            if (designTokens?.globalCss) {
                this.logger.log('Writing AI-generated globals.css');
                await fs.writeFile(path.join(tempDir, 'src/app/globals.css'), designTokens.globalCss);
            }
            const siteContent = {
                designTokens: websiteData?.designTokens || {},
                seoMetadata: websiteData?.seoMetadata || {},
                business: {
                    name: businessContext.businessName || '',
                    phone: businessContext.phone || '',
                    email: businessContext.email || '',
                    address: businessContext.businessAddress || '',
                    tagline: '',
                },
                pages: pages.map((p) => ({ slug: p.slug, sections: p.content }))
            };
            await fs.writeFile(path.join(tempDir, 'src/data/content.json'), JSON.stringify(siteContent, null, 2));
            let buildSuccess = false;
            let buildRetries = 0;
            const MAX_RETRIES = 1;
            while (!buildSuccess && buildRetries <= MAX_RETRIES) {
                try {
                    this.logger.log(`Running build validation... (Attempt ${buildRetries + 1})`);
                    await execAsync('npm install', { cwd: tempDir });
                    await execAsync('npm run build', { cwd: tempDir });
                    buildSuccess = true;
                    this.logger.log(`Build validation successful!`);
                }
                catch (error) {
                    const stderr = error.stderr || error.message;
                    this.logger.warn(`Build failed: ${stderr}`);
                    if (buildRetries >= MAX_RETRIES) {
                        this.logger.error('Max build retries exceeded. Falling back to safe hardcoded components.');
                        await execAsync(`rm -rf ${componentsDir}`);
                        await execAsync(`cp -R ${backupDir} ${componentsDir}`);
                        await execAsync(`cp ${path.join(templateDir, 'src/app/globals.css')} ${path.join(tempDir, 'src/app/globals.css')}`);
                        break;
                    }
                    buildRetries++;
                }
            }
            const vercelToken = this.configService.get('VERCEL_API_TOKEN');
            if (!vercelToken)
                throw new Error('VERCEL_API_TOKEN is not configured');
            const projectNameSlug = businessContext.businessName
                ? businessContext.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
                : `project-${projectId.substring(0, 8)}`;
            const finalProjectName = `${projectNameSlug}-${projectId.substring(0, 4)}`;
            this.logger.log(`Deploying to Vercel project: ${finalProjectName}`);
            const apiUrl = this.configService.get('API_URL') || 'http://localhost:3000';
            const deployCommand = `npx --yes vercel deploy --prod --yes --token ${vercelToken} --name ${finalProjectName} --build-env NEXT_PUBLIC_API_URL=${apiUrl} --build-env NEXT_PUBLIC_PROJECT_ID=${projectId}`;
            const { stdout, stderr } = await execAsync(deployCommand, { cwd: tempDir });
            if (stderr && !stderr.includes('Inspect')) {
                this.logger.warn(`Vercel CLI output (stderr): ${stderr}`);
            }
            const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
            const liveUrl = urlMatch ? urlMatch[0] : stdout.trim();
            this.logger.log(`Deployment successful! Live URL: ${liveUrl}`);
            return liveUrl;
        }
        catch (error) {
            this.logger.error(`Failed to build and deploy project ${projectId}`, error.stack);
            throw error;
        }
        finally {
            this.logger.log(`Cleaning up temporary directory ${tempDir}`);
            await fs.rm(tempDir, { recursive: true, force: true }).catch(err => this.logger.warn(`Failed to cleanup temp dir: ${err.message}`));
        }
    }
};
exports.NextjsBuilderService = NextjsBuilderService;
exports.NextjsBuilderService = NextjsBuilderService = NextjsBuilderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        business_context_service_1.BusinessContextService,
        website_data_service_1.WebsiteDataService,
        page_service_1.PageService])
], NextjsBuilderService);
//# sourceMappingURL=nextjs-builder.service.js.map