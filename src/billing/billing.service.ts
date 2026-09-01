import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { getErrorMessage } from '../common/utils/error.util';

import { STRIPE_CLIENT } from '../stripe/stripe.module';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private webhookSecret: string;
  private frontendUrl: string;

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

  }

  async reconcileBilling(userId: string, subscriptionId: string): Promise<void> {
    this.logger.log(`Reconciling billing for user ${userId}, subscription: ${subscriptionId}`);
    // Sync the local DB with Stripe if needed
    if (!this.stripe) return;
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: subscription.status,
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to reconcile billing for ${userId}: ${getErrorMessage(error)}`);
    }
  }

  async reconcileAllSubscriptions(): Promise<void> {
    this.logger.log('Starting daily billing reconciliation for all active subscriptions.');
    if (!this.stripe) return;

    try {
      // Find all subscriptions that are currently active in our DB
      const subscriptions = await this.prisma.subscription.findMany({
        where: { status: 'active' },
      });

      this.logger.log(`Found ${subscriptions.length} active subscriptions to reconcile.`);

      for (const sub of subscriptions) {
        if (!sub.stripeSubscriptionId) continue;
        
        try {
          const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          
          if (stripeSub.status !== sub.status) {
            this.logger.warn(`Discrepancy found for user ${sub.userId}. Stripe: ${stripeSub.status}, DB: ${sub.status}. Updating DB.`);
            
            await this.prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: stripeSub.status,
                currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
              },
            });
          }
        } catch (err) {
          this.logger.error(`Failed to reconcile individual subscription ${sub.stripeSubscriptionId}: ${getErrorMessage(err)}`);
        }
      }
      
      this.logger.log('Daily billing reconciliation completed successfully.');
    } catch (error) {
      this.logger.error(`Failed to run full billing reconciliation: ${getErrorMessage(error)}`);
    }
  }

  async createCheckoutSession(userId: string, _planId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let customerId = '';
    const existingSubscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    } else {
      const customer = await this.stripe.customers.create({ email: user.email, metadata: { userId } });
      customerId = customer.id;
    }

    const priceId = this.configService.get<string>('STRIPE_SUBSCRIPTION_PRICE_ID');
    if (!priceId) throw new BadRequestException('STRIPE_SUBSCRIPTION_PRICE_ID not configured');

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${this.frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/billing`,
      client_reference_id: userId,
    });

    return { url: session.url };
  }

  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) {
      return { status: 'none' };
    }
    return subscription;
  }

  async cancelSubscription(userId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');

    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new NotFoundException('No active subscription found');

    const canceledSub = await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const updatedSub = await this.prisma.subscription.update({
      where: { userId },
      data: {
        status: canceledSub.status,
      },
    });

    return updatedSub;
  }

  async getPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe || !this.webhookSecret) {
      this.logger.warn('Stripe or webhook secret not configured. Ignoring webhook.');
      return { received: true };
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Handling Stripe event: ${event.type} [${event.id}]`);

    // Idempotency check
    const existingEvent = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });

    if (existingEvent) {
      this.logger.log(`Event ${event.id} already processed. Skipping.`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === 'subscription' && session.client_reference_id) {
            const userId = session.client_reference_id;
            const subscriptionId = session.subscription as string;
            
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            
            await this.prisma.subscription.upsert({
              where: { userId },
              update: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                planId: 'pro', // Map to your internal plan IDs if dynamic
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              },
              create: {
                userId,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                planId: 'pro',
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              },
            });
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const subRecord = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
          });

          if (subRecord) {
            await this.prisma.subscription.update({
              where: { id: subRecord.id },
              data: {
                status: subscription.status,
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              },
            });
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;

          const subRecord = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
          });

          if (subRecord && (invoice as any).payment_intent) {
            await this.prisma.payment.upsert({
              where: { stripePaymentId: (invoice as any).payment_intent as string },
              update: {
                status: 'succeeded',
              },
              create: {
                userId: subRecord.userId,
                stripePaymentId: (invoice as any).payment_intent as string,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: 'succeeded',
              },
            });
          }
          break;
        }
        default:
          this.logger.log(`Unhandled event type ${event.type}`);
      }

      // Record event to prevent double-processing
      await this.prisma.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
        },
      });
    } catch (err) {
      this.logger.error(`Error processing webhook event ${event.type}: ${err.message}`);
    }

    return { received: true };
  }
}
