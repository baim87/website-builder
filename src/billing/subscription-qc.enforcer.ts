import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QualityControlProducer } from '../queue/producers/quality-control.producer';

interface ProjectGeneratedPayload {
  projectId: string;
  userId: string;
  liveUrl: string;
  businessName: string;
}

@Injectable()
export class SubscriptionQCEnforcer {
  private readonly logger = new Logger(SubscriptionQCEnforcer.name);

  constructor(
    private readonly qcProducer: QualityControlProducer,
  ) {}

  @OnEvent('project.generated')
  async handleProjectGeneratedEvent(payload: ProjectGeneratedPayload) {
    this.logger.log(`Received 'project.generated' event for ${payload.projectId}. Checking billing tier...`);

    // --- DEV MODE / BILLING BYPASS ---
    // In development or if bypass is enabled, we automatically queue the QC job.
    if (process.env.APP_ENV === 'development' || process.env.BYPASS_BILLING === 'true') {
      this.logger.log(`[${payload.projectId}] DEV MODE: Bypass billing checks. Queuing Quality Control.`);
      await this.qcProducer.triggerQualityControl(
        payload.projectId,
        payload.userId,
        payload.liveUrl,
        payload.businessName
      );
      return;
    }

    // --- PRODUCTION BILLING LOGIC ---
    // TODO: Implement actual Stripe/Billing checks here in the future
    // Example:
    // const hasPremium = await this.billingService.userHasPremiumQC(payload.userId);
    // if (!hasPremium) {
    //   this.logger.log(`[${payload.projectId}] User ${payload.userId} is on basic tier. Skipping QC.`);
    //   return;
    // }
    
    // For now, if we are not in dev and bypass is off, we still queue it by default 
    // until the real pricing plans are built.
    this.logger.log(`[${payload.projectId}] Production: Queuing Quality Control.`);
    await this.qcProducer.triggerQualityControl(
        payload.projectId,
        payload.userId,
        payload.liveUrl,
        payload.businessName
    );
  }
}
