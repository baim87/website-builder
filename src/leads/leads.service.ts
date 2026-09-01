import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getErrorMessage } from '../common/utils/error.util';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initializeMailer();
  }

  private initializeMailer() {
    const user = this.configService.get<string>('SMTP_EMAIL');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

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

  async forwardLead(projectId: string, leadData: any) {
    this.logger.log(`Received new lead for project ${projectId}`);

    // Find the project and the owner's email
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { user: true },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
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
      if (!this.transporter) throw new Error('Mailer not initialized');

      await this.transporter.sendMail({
        from: `"Local Empire Leads" <${this.configService.get<string>('SMTP_EMAIL')}>`,
        to: contractorEmail,
        subject: `New Lead: ${service || 'Service Inquiry'} from ${name}`,
        html: htmlContent,
      });

      this.logger.log(`Successfully forwarded lead to ${contractorEmail}`);
      return { success: true, message: 'Lead forwarded successfully' };
    } catch (error) {
      this.logger.error(`Failed to send lead email: ${getErrorMessage(error)}`);
      throw new HttpException('Failed to forward lead', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
