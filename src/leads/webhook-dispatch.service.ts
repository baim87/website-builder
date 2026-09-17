import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Lead, WebhookIntegration } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatch a new lead to all active webhook integrations for a project
   */
  async dispatchNewLead(projectId: string, lead: Lead) {
    const integrations = await this.prisma.webhookIntegration.findMany({
      where: { projectId, isActive: true },
    });

    if (integrations.length === 0) {
      return;
    }

    const payload = {
      event: 'lead.created',
      timestamp: new Date().toISOString(),
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        service: lead.message, // Some mappings expect service
        message: lead.message,
        source: lead.source,
        status: lead.status,
        metadata: lead.metadata,
        createdAt: lead.createdAt.toISOString(),
      },
    };

    // Fire and forget all webhooks in parallel
    Promise.allSettled(
      integrations.map((integration) => this.sendWebhook(integration, payload))
    ).then((results) => {
      results.forEach((res, index) => {
        if (res.status === 'rejected') {
          this.logger.error(`Failed to send webhook to integration ${integrations[index].name}: ${res.reason}`);
        }
      });
    });
  }

  /**
   * Send a test webhook to a specific integration
   */
  async sendTestWebhook(integrationId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const integration = await this.prisma.webhookIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Local Empire',
    };

    try {
      const response = await this.sendWebhook(integration, payload);
      return { success: response.ok, statusCode: response.status };
    } catch (error: any) {
      return { 
        success: false, 
        statusCode: 500, 
        error: error.message 
      };
    }
  }

  /**
   * Core method to send the actual HTTP request with HMAC signing
   */
  private async sendWebhook(integration: WebhookIntegration, payload: object) {
    const payloadStr = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': timestamp,
      'User-Agent': 'LocalEmpire-Webhook-Service/1.0',
    };

    // If there are custom headers defined by user, merge them
    if (integration.headers && typeof integration.headers === 'object') {
      Object.assign(headers, integration.headers as Record<string, string>);
    }

    // Add HMAC signature if a secret is configured
    if (integration.secret) {
      const signature = crypto
        .createHmac('sha256', integration.secret)
        .update(`${timestamp}.${payloadStr}`)
        .digest('hex');
      headers['X-Webhook-Signature'] = `v1=${signature}`;
    }

    this.logger.log(`Dispatching webhook to ${integration.name} (${integration.url})`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(integration.url, {
        method: 'POST',
        headers,
        body: payloadStr,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
