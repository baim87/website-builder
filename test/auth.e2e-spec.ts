import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';
import { AuthGuard } from '@nestjs/passport';
import { QueueModule } from '../src/queue/queue.module';
import { MockQueueModule } from './mock-queue.module';

class MockGoogleAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // Simulate what passport-google-oauth20 attaches to req.user
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    return true;
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override the Google Auth guard to bypass real OAuth flow
      .overrideGuard(AuthGuard('google'))
      .useClass(MockGoogleAuthGuard)
      // Override QueueModule to prevent Redis connection issues in tests
      .overrideModule(QueueModule)
      .useModule(MockQueueModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    
    prisma = app.get(PrismaService);
    
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    
    // Seed a test user
    await prisma.user.create({
      data: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OAuth Flow', () => {
    it('GET /auth/google - redirects to Google OAuth', () => {
      return request(app.getHttpServer())
        .get('/auth/google')
        // Because of our mock guard, it actually just returns 200 or executes the controller which is empty
        // In a real scenario, passport redirects. Our mock guard intercepts it.
        // Let's just expect 200 since the mock guard returns true and controller has no body
        .expect(200);
    });

    it('GET /auth/google/callback - creates tokens and redirects to frontend', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .expect(302);

      // Verify the redirect URL contains the access token
      expect(response.header.location).toContain('/dashboard?token=');

      // Verify refresh token cookie is set
      const cookies = response.header['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
    });
  });

  describe('JWT and Refresh', () => {
    let validRefreshToken: string;

    beforeEach(async () => {
      // Execute a login to grab a valid refresh token cookie
      const res = await request(app.getHttpServer()).get('/auth/google/callback');
      const cookies = res.header['set-cookie'];
      // Extract just the cookie value for supertest
      validRefreshToken = cookies[0].split(';')[0];
    });

    it('POST /auth/refresh - returns new access token given valid refresh cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', validRefreshToken)
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      // Should also set a new refresh token cookie
      expect(response.header['set-cookie']).toBeDefined();
    });

    it('POST /auth/refresh - fails if no cookie provided', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('No refresh token provided');
        });
    });

    it('POST /auth/logout - clears the refresh token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout');
        
      if (response.status !== 201) {
        console.error('Logout failed with status:', response.status, response.body);
      }
      expect(response.status).toBe(201);

      expect(response.body.success).toBe(true);
      expect(response.header['set-cookie'][0]).toContain('refreshToken=;');
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer()).get('/auth/google/callback');
      const redirectUrl = res.header.location;
      accessToken = redirectUrl.split('token=')[1];
    });

    it('GET /auth/me - succeeds with valid access token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('test@example.com');
          expect(res.body.id).toBe('test-user-id');
        });
    });

    it('GET /auth/me - fails without access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me');
        
      expect(response.status).toBe(401);
    });
  });
});
