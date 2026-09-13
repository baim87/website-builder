import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getErrorMessage } from '../common/utils/error.util';
import { LeadsGateway } from './leads.gateway';
import { google } from 'googleapis';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly leadsGateway: LeadsGateway,
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

  async forwardLead(projectId: string, leadData: any) {
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
    const { name, email, phone, service, message, source } = leadData;

    // 2. Save lead to the database
    const savedLead = await this.prisma.lead.create({
      data: {
        projectId,
        name,
        email,
        phone,
        message,
        source: source || 'website',
      }
    });

    // 3. Emit real-time notification to WebSocket
    this.leadsGateway.notifyNewLead(contractorUser.id, {
      id: savedLead.id,
      name,
      date: savedLead.createdAt.toLocaleDateString(),
      time: savedLead.createdAt.toLocaleTimeString(),
      service,
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

    // 4. Set up Mailer using User's credentials
    let transporter: nodemailer.Transporter | null = null;
    try {
      if (!contractorUser.gmailRefreshToken) {
        this.logger.warn(`User ${contractorUser.id} has no gmailRefreshToken. Cannot send emails on their behalf.`);
      } else {
        transporter = await this.createTransporterForUser(contractorEmail, contractorUser.gmailRefreshToken);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize OAuth2 Transporter for user: ${getErrorMessage(error)}`);
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
          from: contractorEmail,
          to: contractorEmail,
          subject: `New Lead: ${service || 'Service Inquiry'} from ${name}`,
          html: contractorHtml,
        });

        // Send to Submitter (if they provided an email)
        if (email) {
          await transporter.sendMail({
            from: contractorEmail,
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
}
