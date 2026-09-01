import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthClient } from './google-auth.client';

@Injectable()
export class GscClient {
  private readonly logger = new Logger(GscClient.name);
  private gscApi: ReturnType<typeof google.webmasters>;

  constructor(private readonly authClient: GoogleAuthClient) {
    try {
      this.gscApi = google.webmasters({ version: 'v3', auth: this.authClient.jwtClient });
    } catch (e) {
      this.logger.warn('GSC Client not initialized (missing auth credentials)');
    }
  }

  async verifySite(domainName: string) {
    const siteUrl = `https://${domainName}`;
    this.logger.log(`Adding ${siteUrl} to Search Console`);
    
    if (!this.gscApi) {
      throw new Error('GSC API client not initialized');
    }

    await this.gscApi.sites.add({
      siteUrl,
    });
  }
}
