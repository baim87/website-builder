import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { GoogleAuthClient } from './google-auth.client';

@Injectable()
export class GtmClient {
  private readonly logger = new Logger(GtmClient.name);
  private gtmApi: ReturnType<typeof google.tagmanager>;

  constructor(
    private readonly configService: ConfigService,
    private readonly authClient: GoogleAuthClient,
  ) {
    try {
      this.gtmApi = google.tagmanager({ version: 'v2', auth: this.authClient.jwtClient });
    } catch (e) {
      this.logger.warn('GTM Client not initialized (missing auth credentials)');
    }
  }

  async createContainer(domainName: string) {
    const accountId = this.configService.get<string>('GOOGLE_TAG_MANAGER_ACCOUNT_ID');
    if (!accountId) throw new Error('Missing GTM Account ID in env');

    if (!this.gtmApi) throw new Error('GTM API client not initialized');

    this.logger.log(`Creating GTM Container for ${domainName}`);
    
    const containerRes = await this.gtmApi.accounts.containers.create({
      parent: `accounts/${accountId}`,
      requestBody: {
        name: `Local Empire - ${domainName}`,
        usageContext: ['WEB'],
      },
    });

    return containerRes.data.publicId; // e.g., GTM-XXXXX
  }
}
