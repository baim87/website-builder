"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stripe_1 = __importDefault(require("stripe"));
const prisma_service_1 = require("../prisma/prisma.service");
const error_util_1 = require("../common/utils/error.util");
const stripe_module_1 = require("../stripe/stripe.module");
let BillingService = BillingService_1 = class BillingService {
    stripe;
    configService;
    prisma;
    logger = new common_1.Logger(BillingService_1.name);
    webhookSecret;
    frontendUrl;
    constructor(stripe, configService, prisma) {
        this.stripe = stripe;
        this.configService = configService;
        this.prisma = prisma;
        this.webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET') || '';
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
    }
    async reconcileBilling(userId, subscriptionId) {
        this.logger.log(`Reconciling billing for user ${userId}, subscription: ${subscriptionId}`);
        if (!this.stripe)
            return;
        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            await this.prisma.subscription.update({
                where: { userId },
                data: {
                    status: subscription.status,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to reconcile billing for ${userId}: ${(0, error_util_1.getErrorMessage)(error)}`);
        }
    }
    async reconcileAllSubscriptions() {
        this.logger.log('Starting daily billing reconciliation for all active subscriptions.');
        if (!this.stripe)
            return;
        try {
            const subscriptions = await this.prisma.subscription.findMany({
                where: { status: 'active' },
            });
            this.logger.log(`Found ${subscriptions.length} active subscriptions to reconcile.`);
            for (const sub of subscriptions) {
                if (!sub.stripeSubscriptionId)
                    continue;
                try {
                    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
                    if (stripeSub.status !== sub.status) {
                        this.logger.warn(`Discrepancy found for user ${sub.userId}. Stripe: ${stripeSub.status}, DB: ${sub.status}. Updating DB.`);
                        await this.prisma.subscription.update({
                            where: { id: sub.id },
                            data: {
                                status: stripeSub.status,
                                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                            },
                        });
                    }
                }
                catch (err) {
                    this.logger.error(`Failed to reconcile individual subscription ${sub.stripeSubscriptionId}: ${(0, error_util_1.getErrorMessage)(err)}`);
                }
            }
            this.logger.log('Daily billing reconciliation completed successfully.');
        }
        catch (error) {
            this.logger.error(`Failed to run full billing reconciliation: ${(0, error_util_1.getErrorMessage)(error)}`);
        }
    }
    async createCheckoutSession(userId, _planId) {
        if (!this.stripe)
            throw new common_1.BadRequestException('Stripe is not configured');
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        let customerId = '';
        const existingSubscription = await this.prisma.subscription.findUnique({ where: { userId } });
        if (existingSubscription?.stripeCustomerId) {
            customerId = existingSubscription.stripeCustomerId;
        }
        else {
            const customer = await this.stripe.customers.create({ email: user.email, metadata: { userId } });
            customerId = customer.id;
        }
        const priceId = this.configService.get('STRIPE_SUBSCRIPTION_PRICE_ID');
        if (!priceId)
            throw new common_1.BadRequestException('STRIPE_SUBSCRIPTION_PRICE_ID not configured');
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
    async getSubscription(userId) {
        const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
        if (!subscription) {
            return { status: 'none' };
        }
        return subscription;
    }
    async cancelSubscription(userId) {
        if (!this.stripe)
            throw new common_1.BadRequestException('Stripe is not configured');
        const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
        if (!subscription)
            throw new common_1.NotFoundException('No active subscription found');
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
    async getPayments(userId) {
        return this.prisma.payment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async handleWebhook(signature, payload) {
        if (!this.stripe || !this.webhookSecret) {
            this.logger.warn('Stripe or webhook secret not configured. Ignoring webhook.');
            return { received: true };
        }
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
        }
        catch (err) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new common_1.BadRequestException(`Webhook Error: ${err.message}`);
        }
        this.logger.log(`Handling Stripe event: ${event.type} [${event.id}]`);
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
                    const session = event.data.object;
                    if (session.mode === 'subscription' && session.client_reference_id) {
                        const userId = session.client_reference_id;
                        const subscriptionId = session.subscription;
                        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
                        await this.prisma.subscription.upsert({
                            where: { userId },
                            update: {
                                stripeCustomerId: session.customer,
                                stripeSubscriptionId: subscription.id,
                                status: subscription.status,
                                planId: 'pro',
                                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            },
                            create: {
                                userId,
                                stripeCustomerId: session.customer,
                                stripeSubscriptionId: subscription.id,
                                status: subscription.status,
                                planId: 'pro',
                                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            },
                        });
                    }
                    break;
                }
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted': {
                    const subscription = event.data.object;
                    const customerId = subscription.customer;
                    const subRecord = await this.prisma.subscription.findFirst({
                        where: { stripeCustomerId: customerId },
                    });
                    if (subRecord) {
                        await this.prisma.subscription.update({
                            where: { id: subRecord.id },
                            data: {
                                status: subscription.status,
                                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            },
                        });
                    }
                    break;
                }
                case 'invoice.payment_succeeded': {
                    const invoice = event.data.object;
                    const customerId = invoice.customer;
                    const subRecord = await this.prisma.subscription.findFirst({
                        where: { stripeCustomerId: customerId },
                    });
                    if (subRecord && invoice.payment_intent) {
                        await this.prisma.payment.upsert({
                            where: { stripePaymentId: invoice.payment_intent },
                            update: {
                                status: 'succeeded',
                            },
                            create: {
                                userId: subRecord.userId,
                                stripePaymentId: invoice.payment_intent,
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
            await this.prisma.stripeEvent.create({
                data: {
                    id: event.id,
                    type: event.type,
                },
            });
        }
        catch (err) {
            this.logger.error(`Error processing webhook event ${event.type}: ${err.message}`);
        }
        return { received: true };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(stripe_module_1.STRIPE_CLIENT)),
    __metadata("design:paramtypes", [stripe_1.default,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], BillingService);
//# sourceMappingURL=billing.service.js.map