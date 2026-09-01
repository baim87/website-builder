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
var LeadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
const error_util_1 = require("../common/utils/error.util");
let LeadsService = LeadsService_1 = class LeadsService {
    prisma;
    configService;
    logger = new common_1.Logger(LeadsService_1.name);
    transporter;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.initializeMailer();
    }
    initializeMailer() {
        const user = this.configService.get('SMTP_EMAIL');
        const pass = this.configService.get('SMTP_PASSWORD');
        if (!user || !pass) {
            this.logger.warn('SMTP credentials missing. Lead forwarding will fail.');
            return;
        }
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass,
            },
        });
    }
    async forwardLead(projectId, leadData) {
        this.logger.log(`Received new lead for project ${projectId}`);
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { user: true },
        });
        if (!project) {
            throw new common_1.HttpException('Project not found', common_1.HttpStatus.NOT_FOUND);
        }
        const contractorEmail = project.user.email;
        const { name, email, phone, service, message } = leadData;
        const htmlContent = `
      <h2>New Lead from your Website!</h2>
      <p><strong>Name:</strong> ${name || 'N/A'}</p>
      <p><strong>Email:</strong> ${email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Service Requested:</strong> ${service || 'N/A'}</p>
      <br/>
      <p><strong>Message:</strong></p>
      <p>${message || 'No message provided.'}</p>
    `;
        try {
            if (!this.transporter)
                throw new Error('Mailer not initialized');
            await this.transporter.sendMail({
                from: `"Local Empire Leads" <${this.configService.get('SMTP_EMAIL')}>`,
                to: contractorEmail,
                subject: `New Lead: ${service || 'Service Inquiry'} from ${name}`,
                html: htmlContent,
            });
            this.logger.log(`Successfully forwarded lead to ${contractorEmail}`);
            return { success: true, message: 'Lead forwarded successfully' };
        }
        catch (error) {
            this.logger.error(`Failed to send lead email: ${(0, error_util_1.getErrorMessage)(error)}`);
            throw new common_1.HttpException('Failed to forward lead', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = LeadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map