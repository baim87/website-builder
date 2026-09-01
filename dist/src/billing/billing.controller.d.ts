import type { RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Request } from 'express';
interface AuthenticatedRequest extends Request {
    user: {
        userId: string;
        email: string;
    };
}
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    createCheckoutSession(req: AuthenticatedRequest, planId: string): Promise<{
        url: string | null;
    }>;
    getSubscription(req: AuthenticatedRequest): Promise<{
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
    cancelSubscription(req: AuthenticatedRequest): Promise<{
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
    getPayments(req: AuthenticatedRequest): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: string;
        stripePaymentId: string;
        amount: number;
        currency: string;
    }[]>;
    handleWebhook(signature: string, req: RawBodyRequest<Request>): Promise<{
        received: boolean;
    }>;
}
export {};
