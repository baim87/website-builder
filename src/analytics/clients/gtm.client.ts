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

  async createContainer(domainName: string, businessName: string) {
    const accountId = this.configService.get<string>('GOOGLE_TAG_MANAGER_ACCOUNT_ID');
    if (!accountId) throw new Error('Missing GTM Account ID in env');

    if (!this.gtmApi) throw new Error('GTM API client not initialized');

    this.logger.log(`Creating GTM Container for ${domainName} (${businessName})`);
    
    const containerRes = await this.gtmApi.accounts.containers.create({
      parent: `accounts/${accountId}`,
      requestBody: {
        name: `LE - ${businessName}`,
        usageContext: ['WEB'],
      },
    });

    return { publicId: containerRes.data.publicId, containerId: containerRes.data.containerId };
  }

  async configureContainer(containerId: string, ga4MeasurementId: string) {
    const accountId = this.configService.get<string>('GOOGLE_TAG_MANAGER_ACCOUNT_ID');
    const containerPath = `accounts/${accountId}/containers/${containerId}`;

    if (!this.gtmApi) throw new Error('GTM API client not initialized');

    this.logger.log(`Configuring GTM Workspace for container ${containerId}`);

    // 1. Get Default Workspace
    const workspacesRes = await this.gtmApi.accounts.containers.workspaces.list({
      parent: containerPath,
    });
    const workspacePath = workspacesRes.data.workspace![0].path!;

    // 2. Enable Built-In Variables (Click URL, Form ID)
    await this.gtmApi.accounts.containers.workspaces.built_in_variables.create({
      parent: workspacePath,
      type: ['CLICK_URL', 'PAGE_URL', 'FORM_CLASSES', 'FORM_ID'],
    });

    // 3. Create All Pages Trigger
    const allPagesRes = await this.gtmApi.accounts.containers.workspaces.triggers.create({
      parent: workspacePath,
      requestBody: {
        name: 'All Pages',
        type: 'pageview',
      },
    });
    const allPagesTriggerId = allPagesRes.data.triggerId!;

    // 4. Create Phone Click Trigger
    const phoneClickRes = await this.gtmApi.accounts.containers.workspaces.triggers.create({
      parent: workspacePath,
      requestBody: {
        name: 'Phone Click',
        type: 'linkClick',
        filter: [
          {
            type: 'startsWith',
            parameter: [
              { type: 'template', key: 'arg0', value: '{{Click URL}}' },
              { type: 'template', key: 'arg1', value: 'tel:' },
            ],
          },
        ],
      },
    });
    const phoneClickTriggerId = phoneClickRes.data.triggerId!;

    // 5. Create Form Submission Trigger
    const formSubmitRes = await this.gtmApi.accounts.containers.workspaces.triggers.create({
      parent: workspacePath,
      requestBody: {
        name: 'Form Submission',
        type: 'formSubmission',
      },
    });
    const formSubmitTriggerId = formSubmitRes.data.triggerId!;

    // 5.1 Create Email Click Trigger
    const emailClickRes = await this.gtmApi.accounts.containers.workspaces.triggers.create({
      parent: workspacePath,
      requestBody: {
        name: 'Email Click',
        type: 'linkClick',
        filter: [
          {
            type: 'startsWith',
            parameter: [
              { type: 'template', key: 'arg0', value: '{{Click URL}}' },
              { type: 'template', key: 'arg1', value: 'mailto:' },
            ],
          },
        ],
      },
    });
    const emailClickTriggerId = emailClickRes.data.triggerId!;

    // 6. Create GA4 Configuration Tag
    await this.gtmApi.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: 'GA4 Configuration',
        type: 'gaawc',
        parameter: [
          { type: 'template', key: 'measurementId', value: ga4MeasurementId },
        ],
        firingTriggerId: [allPagesTriggerId],
      },
    });

    // 7. Create Phone Click Event Tag
    await this.gtmApi.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: 'GA4 Event - Phone Click',
        type: 'gaawe',
        parameter: [
          { type: 'template', key: 'measurementIdOverride', value: ga4MeasurementId },
          { type: 'template', key: 'eventName', value: 'phone_click' },
        ],
        firingTriggerId: [phoneClickTriggerId],
      },
    });

    // 8. Create Form Submission Event Tag
    await this.gtmApi.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: 'GA4 Event - Form Submission',
        type: 'gaawe',
        parameter: [
          { type: 'template', key: 'measurementIdOverride', value: ga4MeasurementId },
          { type: 'template', key: 'eventName', value: 'form_submit' },
        ],
        firingTriggerId: [formSubmitTriggerId],
      },
    });

    // 8.1 Create Email Click Event Tag
    await this.gtmApi.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: 'GA4 Event - Email Click',
        type: 'gaawe',
        parameter: [
          { type: 'template', key: 'measurementIdOverride', value: ga4MeasurementId },
          { type: 'template', key: 'eventName', value: 'email_click' },
        ],
        firingTriggerId: [emailClickTriggerId],
      },
    });

    // 9. Create Version and Publish
    this.logger.log(`Publishing GTM Workspace for container ${containerId}`);
    const versionRes = await this.gtmApi.accounts.containers.workspaces.create_version({
      path: workspacePath,
      requestBody: {
        name: 'Initial Setup',
      }
    });
    const versionPath = versionRes.data.containerVersion?.path;
    
    if (versionPath) {
      await this.gtmApi.accounts.containers.versions.publish({
        path: versionPath,
      });
    } else {
      this.logger.error('Failed to get container version path. Workspace was not published.');
    }
  }

  async grantAdminAccess(containerId: string, emailAddress: string) {
    const accountId = this.configService.get<string>('GOOGLE_TAG_MANAGER_ACCOUNT_ID');
    if (!this.gtmApi) throw new Error('GTM API client not initialized');

    this.logger.log(`Granting GTM access to ${emailAddress} for container ${containerId}`);

    await this.gtmApi.accounts.user_permissions.create({
      parent: `accounts/${accountId}`,
      requestBody: {
        emailAddress,
        accountAccess: {
          // You must have user access to view the account
          permission: 'user', 
        },
        containerAccess: [
          {
            containerId,
            permission: 'publish', // Full publish rights to the container
          },
        ],
      },
    });
  }
}
