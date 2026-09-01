import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { getErrorMessage } from '../../common/utils/error.util';

@Injectable()
export class GoogleAuthClient {
  private readonly logger = new Logger(GoogleAuthClient.name);
  private _jwtClient: any;
  private _clientEmail: string | undefined;
  private _privateKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.initializeAuth();
  }

  private initializeAuth() {
    this._clientEmail = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    this._privateKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    if (!this._clientEmail || !this._privateKey) {
      this.logger.warn('Google Service Account credentials missing in environment.');
      return;
    }

    try {
      this._jwtClient = new google.auth.JWT({
        email: this._clientEmail,
        key: this._privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/analytics.edit',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts',
          'https://www.googleapis.com/auth/webmasters',
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to initialize Google Auth JWT: ${getErrorMessage(error)}`);
    }
  }

  get jwtClient() {
    if (!this._jwtClient) {
      throw new Error('Google Auth Client not initialized due to missing credentials');
    }
    return this._jwtClient;
  }

  get clientEmail() {
    return this._clientEmail;
  }

  get privateKey() {
    return this._privateKey;
  }
}
