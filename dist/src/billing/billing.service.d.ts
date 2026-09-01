import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
export declare class BillingService {
    private readonly stripe;
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private webhookSecret;
    private frontendUrl;
    constructor(stripe: Stripe, configService: ConfigService, prisma: PrismaService);
    reconcileBilling(userId: string, subscriptionId: string): Promise<void>;
    reconcileAllSubscriptions(): Promise<void>;
    createCheckoutSession(userId: string, _planId: string): Promise<{
        url: string | null;
    }>;
    getSubscription(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        planId: string;
        currentPeriodEnd: Date;
    } | {
        status: string;
    }>;
    cancelSubscription(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        planId: string;
        currentPeriodEnd: Date;
    }>;
    getPayments(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        stripePaymentId: string;
        amount: number;
        currency: string;
    }[]>;
    handleWebhook(signature: string, payload: Buffer): Promise<{
        received: boolean;
    }>;
}
