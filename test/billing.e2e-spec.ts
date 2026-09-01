import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';
import { STRIPE_CLIENT } from '../src/stripe/stripe.module';
import { QueueModule } from '../src/queue/queue.module';
import { MockQueueModule } from './mock-queue.module';
import { BillingService } from '../src/billing/billing.service';

const mockStripeClient = {
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  customers: {
    create: jest.fn(),
  },
  checkout: {
    sessions: { create: jest.fn() },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

describe('BillingModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let billingService: BillingService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(QueueModule)
      .useModule(MockQueueModule)
      .overrideProvider(STRIPE_CLIENT)
      .useValue(mockStripeClient)
      .compile();

    app = moduleFixture.createNestApplication();
    
    // We need rawBody for stripe webhook parsing
    app.useBodyParser('json', { limit: '10mb' }); // Default body parser
    
    prisma = app.get(PrismaService);
    billingService = app.get(BillingService);
    
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    jest.clearAllMocks();
    
    // Seed user
    await prisma.user.create({
      data: {
        id: 'user-1',
        email: 'billing@example.com',
        name: 'Billing User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Stripe Webhooks', () => {
    it('POST /api/billing/webhook - ignores if event already processed', async () => {
      mockStripeClient.webhooks.constructEvent.mockReturnValue({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: {} }
      });

      // Seed event
      await prisma.stripeEvent.create({
        data: { id: 'evt_123', type: 'checkout.session.completed' },
      });

      const response = await request(app.getHttpServer())
        .post('/billing/webhook')
        .send({ foo: 'bar' })
        .set('stripe-signature', 'fake_sig')
        .expect(201);

      expect(response.body).toEqual({ received: true });
      // Verify subscription was NOT created because event was skipped
      const sub = await prisma.subscription.findUnique({ where: { userId: 'user-1' } });
      expect(sub).toBeNull();
    });

    it('POST /api/billing/webhook - processes checkout.session.completed', async () => {
      mockStripeClient.webhooks.constructEvent.mockReturnValue({
        id: 'evt_456',
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            client_reference_id: 'user-1',
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      });

      mockStripeClient.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      });

      const response = await request(app.getHttpServer())
        .post('/billing/webhook')
        .send({})
        .set('stripe-signature', 'fake_sig')
        .expect(201);

      expect(response.body).toEqual({ received: true });

      const sub = await prisma.subscription.findUnique({ where: { userId: 'user-1' } });
      expect(sub).not.toBeNull();
      expect(sub!.status).toBe('active');
      expect(sub!.stripeSubscriptionId).toBe('sub_123');

      // Verify event was recorded
      const evt = await prisma.stripeEvent.findUnique({ where: { id: 'evt_456' } });
      expect(evt).not.toBeNull();
    });
  });

  describe('Reconciliation', () => {
    it('reconcileAllSubscriptions updates mismatched status', async () => {
      // Seed active subscription
      await prisma.subscription.create({
        data: {
          userId: 'user-1',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          status: 'active', // our db says active
          planId: 'pro',
          currentPeriodEnd: new Date(),
        },
      });

      // Mock stripe returning canceled
      mockStripeClient.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      });

      await billingService.reconcileAllSubscriptions();

      // Verify db was updated
      const sub = await prisma.subscription.findUnique({ where: { userId: 'user-1' } });
      expect(sub!.status).toBe('canceled');
    });

    it('reconcileAllSubscriptions skips if status matches', async () => {
      // Seed active subscription
      await prisma.subscription.create({
        data: {
          userId: 'user-1',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          status: 'active',
          planId: 'pro',
          currentPeriodEnd: new Date(),
        },
      });

      mockStripeClient.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      });

      await billingService.reconcileAllSubscriptions();

      // Retrieve should have been called once, but no update should occur (status stays active)
      expect(mockStripeClient.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
      const sub = await prisma.subscription.findUnique({ where: { userId: 'user-1' } });
      expect(sub!.status).toBe('active');
    });
  });
});
