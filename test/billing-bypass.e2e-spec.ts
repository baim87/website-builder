import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingGuard } from '../src/common/guards/billing.guard';
import { clearDatabase } from './test-utils';

// We create a minimal mock controller to test the BillingGuard behavior in isolation
@Controller('test-billing')
class TestBillingController {
  @UseGuards(BillingGuard)
  @Get('protected')
  getProtectedResource() {
    return { success: true, data: 'You have access!' };
  }
}

// A mock guard to simulate an authenticated user context (since BillingGuard relies on req.user)
import { ExecutionContext, CanActivate } from '@nestjs/common';
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('BillingGuard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  
  async function setupApp(bypassBilling: boolean) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ BYPASS_BILLING: bypassBilling })],
        }),
        PrismaModule,
      ],
      controllers: [TestBillingController],
      providers: [BillingGuard],
    })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // We apply our mock AuthGuard globally to simulate a logged-in user
    app.useGlobalGuards(new MockAuthGuard());
    
    prisma = app.get(PrismaService);
    
    await app.init();
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('When BYPASS_BILLING is true', () => {
    beforeEach(async () => {
      await setupApp(true);
      await clearDatabase(prisma);
      await prisma.user.create({
        data: { id: 'test-user-id', email: 'test@example.com', name: 'Tester' },
      });
    });

    it('allows access even if user has no subscription', async () => {
      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('When BYPASS_BILLING is false', () => {
    beforeEach(async () => {
      await setupApp(false);
      await clearDatabase(prisma);
      await prisma.user.create({
        data: { id: 'test-user-id', email: 'test@example.com', name: 'Tester' },
      });
    });

    it('denies access (403) if user has no subscription at all', async () => {
      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Active billing subscription required');
    });

    it('denies access (403) if subscription is canceled', async () => {
      await prisma.subscription.create({
        data: {
          userId: 'test-user-id',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'pro',
          status: 'canceled',
          currentPeriodEnd: new Date(Date.now() + 86400000), // future
        },
      });

      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Active billing subscription required');
    });

    it('denies access (403) if subscription is active but expired', async () => {
      await prisma.subscription.create({
        data: {
          userId: 'test-user-id',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'pro',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() - 86400000), // past
        },
      });

      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Billing subscription has expired');
    });

    it('allows access (200) if subscription is active and current', async () => {
      await prisma.subscription.create({
        data: {
          userId: 'test-user-id',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'pro',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 86400000), // future
        },
      });

      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('allows access (200) if subscription is trialing and current', async () => {
      await prisma.subscription.create({
        data: {
          userId: 'test-user-id',
          stripeCustomerId: 'cus_2',
          stripeSubscriptionId: 'sub_2',
          planId: 'pro',
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + 86400000), // future
        },
      });

      const response = await request(app.getHttpServer()).get('/test-billing/protected');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
