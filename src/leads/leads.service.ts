import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getErrorMessage } from '../common/utils/error.util';
import { LeadsGateway } from './leads.gateway';
import { google } from 'googleapis';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { StorageService } from '../storage/storage.service';
import { AssetPathResolverService } from '../assets/asset-path-resolver.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly leadsGateway: LeadsGateway,
    private readonly webhookDispatchService: WebhookDispatchService,
    private readonly storageService: StorageService,
    private readonly assetPathResolver: AssetPathResolverService,
  ) {}

  private async createTransporterForUser(email: string, refreshToken: string): Promise<nodemailer.Transporter> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Google OAuth credentials for user');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    // We attempt to get a fresh access token
    const accessToken = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          reject(new Error('Failed to create access token: ' + err.message));
        }
        resolve(token);
      });
    });

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: email,
        clientId,
        clientSecret,
        refreshToken,
        accessToken: accessToken as string,
      },
    });
  }

  async forwardLead(projectId: string, leadData: any, files?: Array<Express.Multer.File>) {
    this.logger.log(`Received new lead for project ${projectId}`);

    // 1. Find the project and the owner's email & refresh token
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true, businessContext: true },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    const contractorUser = project.user;
    if (!contractorUser) {
       throw new HttpException('Project has no owner', HttpStatus.BAD_REQUEST);
    }

    const contractorEmail = contractorUser.email;
    const businessName = project.businessContext?.businessName || 'Your Local Contractor';
    const { name, email, phone, service, message, source, ...rest } = leadData;

    // 2. Assign default stage or lowest position stage
    let defaultStage = await this.prisma.leadStage.findFirst({
      where: { projectId, isDefault: true }
    });
    
    if (!defaultStage) {
      defaultStage = await this.prisma.leadStage.findFirst({
        where: { projectId },
        orderBy: { position: 'asc' }
      });
    }

    // 2.5 Save lead to the database (without attachments first to get an ID)
    const savedLead = await this.prisma.lead.create({
      data: {
        projectId,
        stageId: defaultStage?.id,
        name,
        email,
        phone,
        message,
        source: source || 'website',
        metadata: rest,
      },
      include: { stage: true }
    });

    // 2.8 Process and upload attachments if present
    const attachmentUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const { key } = this.assetPathResolver.resolveLeadAttachmentPath(
          contractorUser.id,
          projectId,
          savedLead.id,
          file.originalname
        );
        
        await this.storageService.upload(key, file.buffer, file.mimetype);
        const publicUrl = `${this.configService.get('R2_PUBLIC_URL')}/${key}`;
        attachmentUrls.push(publicUrl);
      }
      
      // Update the lead with the uploaded attachment URLs
      await this.prisma.lead.update({
        where: { id: savedLead.id },
        data: { attachments: attachmentUrls }
      });
      
      // Add to savedLead so subsequent tasks (like webhooks/emails) can use them
      (savedLead as any).attachments = attachmentUrls;
    }

    // 3. Emit real-time notification to WebSocket
    this.leadsGateway.notifyNewLead(contractorUser.id, savedLead);

    // 3.5 Dispatch webhooks asynchronously
    this.webhookDispatchService.dispatchNewLead(projectId, savedLead).catch((err) => {
      this.logger.error(`Failed to dispatch webhooks: ${getErrorMessage(err)}`);
    });

    // Escaping helper for emails
    const escapeHtml = (unsafe: string) => {
      if (!unsafe) return 'N/A';
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeService = escapeHtml(service);
    const safeMessage = escapeHtml(message);

    let extraFieldsHtml = '';
    if (Object.keys(rest).length > 0) {
      extraFieldsHtml = '<br/><h3>Additional Details:</h3>';
      for (const [key, val] of Object.entries(rest)) {
        extraFieldsHtml += `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(val))}</p>`;
      }
    }

    if (attachmentUrls.length > 0) {
      extraFieldsHtml += '<br/><h3>Attachments:</h3><ul>';
      for (const url of attachmentUrls) {
        extraFieldsHtml += `<li><a href="${url}" target="_blank">View File</a></li>`;
      }
      extraFieldsHtml += '</ul>';
    }

    // 4. Set up Mailer using User's credentials or SMTP Fallback
    let transporter: nodemailer.Transporter | null = null;
    let senderEmail = contractorEmail;

    try {
      if (!contractorUser.gmailRefreshToken) {
        this.logger.warn(`User ${contractorUser.id} has no gmailRefreshToken. Falling back to SMTP.`);
        senderEmail = this.configService.get<string>('SMTP_USER') || 'noreply@yourwebsite.com';
        transporter = nodemailer.createTransport({
          host: this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com',
          port: this.configService.get<number>('SMTP_PORT') || 465,
          secure: true,
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS'),
          },
        });
      } else {
        transporter = await this.createTransporterForUser(contractorEmail, contractorUser.gmailRefreshToken);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Transporter: ${getErrorMessage(error)}`);
    }

    if (transporter) {
      // 5. Send Email to Contractor (Notification)
      const contractorHtml = `
        <h2>New Lead from your Website!</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Phone:</strong> ${safePhone}</p>
        <p><strong>Service Requested:</strong> ${safeService}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p>${safeMessage === 'N/A' ? 'No message provided.' : safeMessage}</p>
        ${extraFieldsHtml}
      `;

      // 6. Send Email to Submitter (Receipt)
      const submitterHtml = `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Thank you for reaching out to ${businessName}!</h2>
          <p>Hi ${safeName},</p>
          <p>We have received your inquiry regarding <strong>${safeService}</strong>.</p>
          <p>Our team will review your message and get back to you as soon as possible.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>${businessName}</strong></p>
        </div>
      `;

      try {
        // Send to Contractor
        await transporter.sendMail({
          from: senderEmail,
          to: contractorEmail,
          subject: `New Lead: ${service || 'Service Inquiry'} from ${name}`,
          html: contractorHtml,
          replyTo: email,
        });

        // Send to Submitter (if they provided an email)
        if (email) {
          await transporter.sendMail({
            from: senderEmail,
            to: email,
            subject: `Thank you for contacting ${businessName}`,
            html: submitterHtml,
          });
        }
        
        this.logger.log(`Successfully sent dual lead emails via OAuth2`);
      } catch (error) {
        this.logger.error(`Failed to send lead emails: ${getErrorMessage(error)}`);
      }
    }

    return { success: true, message: 'Lead saved and processed successfully', leadId: savedLead.id };
  }

  async findLeadsByProject(projectId: string, userId: string) {
    // Verify ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    
    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    return this.prisma.lead.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { stage: true }
    });
  }

  async updateLeadStatus(projectId: string, leadId: string, userId: string, updateData: { status?: string, isRead?: boolean }) {
    // Verify ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    
    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    return this.prisma.lead.update({
      where: { id: leadId, projectId },
      data: updateData,
      include: { stage: true }
    });
  }

  // --- STAGE MANAGEMENT ---

  async seedDefaultStages(projectId: string) {
    const existingCount = await this.prisma.leadStage.count({ where: { projectId } });
    if (existingCount > 0) return;

    const defaultStages = [
      { name: 'New Lead', color: '#3B82F6', position: 0, isDefault: true },
      { name: 'Attempted Contact', color: '#F59E0B', position: 1, isDefault: false },
      { name: 'Estimate Scheduled', color: '#8B5CF6', position: 2, isDefault: false },
      { name: 'Estimate Sent', color: '#F97316', position: 3, isDefault: false },
      { name: 'Job Booked', color: '#22C55E', position: 4, isDefault: false },
      { name: 'Job Completed', color: '#10B981', position: 5, isDefault: false },
      { name: 'Lost', color: '#EF4444', position: 6, isDefault: false },
    ];

    await this.prisma.leadStage.createMany({
      data: defaultStages.map(s => ({ ...s, projectId })),
    });
  }

  async getStages(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    let stages = await this.prisma.leadStage.findMany({
      where: { projectId },
      orderBy: { position: 'asc' }
    });

    if (stages.length === 0) {
      await this.seedDefaultStages(projectId);
      stages = await this.prisma.leadStage.findMany({
        where: { projectId },
        orderBy: { position: 'asc' }
      });
    }

    return stages;
  }

  async createStage(projectId: string, userId: string, data: { name: string; color?: string }) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const maxPosStage = await this.prisma.leadStage.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' }
    });
    const position = maxPosStage ? maxPosStage.position + 1 : 0;

    return this.prisma.leadStage.create({
      data: {
        projectId,
        name: data.name,
        color: data.color || '#3B82F6',
        position,
      }
    });
  }

  async updateStage(projectId: string, stageId: string, userId: string, data: { name?: string; color?: string; isDefault?: boolean }) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    if (data.isDefault) {
      // Clear other defaults
      await this.prisma.leadStage.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false }
      });
    }

    return this.prisma.leadStage.update({
      where: { id: stageId, projectId },
      data,
    });
  }

  async deleteStage(projectId: string, stageId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const stage = await this.prisma.leadStage.findUnique({ where: { id: stageId } });
    if (!stage || stage.projectId !== projectId) throw new HttpException('Stage not found', HttpStatus.NOT_FOUND);

    let defaultStage = await this.prisma.leadStage.findFirst({
      where: { projectId, isDefault: true, id: { not: stageId } }
    });
    if (!defaultStage) {
      defaultStage = await this.prisma.leadStage.findFirst({
        where: { projectId, id: { not: stageId } },
        orderBy: { position: 'asc' }
      });
    }

    // Move leads to default stage before deletion
    if (defaultStage) {
      await this.prisma.lead.updateMany({
        where: { stageId, projectId },
        data: { stageId: defaultStage.id }
      });
    }

    return this.prisma.leadStage.delete({
      where: { id: stageId }
    });
  }

  async reorderStages(projectId: string, userId: string, stageIds: string[]) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const updates = stageIds.map((id, index) => 
      this.prisma.leadStage.update({
        where: { id, projectId },
        data: { position: index }
      })
    );

    await this.prisma.$transaction(updates);
    
    return this.prisma.leadStage.findMany({
      where: { projectId },
      orderBy: { position: 'asc' }
    });
  }

  // --- KANBAN OPERATIONS ---

  async moveLead(projectId: string, leadId: string, userId: string, stageId: string, position: number) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const leadToMove = await this.prisma.lead.findUnique({ where: { id: leadId, projectId } });
    if (!leadToMove) throw new HttpException('Lead not found', HttpStatus.NOT_FOUND);

    const updates = [];

    // If moving within same stage
    if (leadToMove.stageId === stageId) {
      const oldPos = leadToMove.position;
      const newPos = position;
      
      if (oldPos < newPos) {
        updates.push(this.prisma.lead.updateMany({
          where: { projectId, stageId, position: { gt: oldPos, lte: newPos } },
          data: { position: { decrement: 1 } }
        }));
      } else if (oldPos > newPos) {
        updates.push(this.prisma.lead.updateMany({
          where: { projectId, stageId, position: { gte: newPos, lt: oldPos } },
          data: { position: { increment: 1 } }
        }));
      }
    } else {
      // If moving to a different stage, shift elements in target stage down
      updates.push(this.prisma.lead.updateMany({
        where: { projectId, stageId, position: { gte: position } },
        data: { position: { increment: 1 } }
      }));
    }

    updates.push(this.prisma.lead.update({
      where: { id: leadId },
      data: { stageId, position },
      include: { stage: true }
    }));

    const results = await this.prisma.$transaction(updates);
    const updatedLead = results[results.length - 1];

    // Emit event for real-time Kanban sync
    this.leadsGateway.notifyLeadMoved(userId, updatedLead);

    return updatedLead;
  }
}
