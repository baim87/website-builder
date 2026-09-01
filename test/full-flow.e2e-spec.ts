import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';
import { AIGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../src/common/constants/queue-names.constant';
import { Queue } from 'bullmq';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user-full-flow' };
    return true;
  }
}

describe('Full Application Flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let aiGateway: AIGatewayService;
  let generationQueue: Queue;
  let aiSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    aiGateway = app.get(AIGatewayService);
    generationQueue = app.get(getQueueToken(QUEUE_NAMES.SITE_GENERATION));
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    await generationQueue.drain();
    
    await prisma.user.create({
      data: { id: 'user-full-flow', email: 'fullflow@example.com', name: 'Full Flow User' },
    });

    await prisma.subscription.create({
      data: {
        userId: 'user-full-flow',
        stripeCustomerId: 'cus_flow',
        stripeSubscriptionId: 'sub_flow',
        planId: 'pro',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400000), // future
      },
    });

    aiSpy = jest.spyOn(aiGateway, 'generateText').mockImplementation(async (model, params) => {
      const system = params.systemPrompt?.toLowerCase() || '';
      let mockResponse = {};
      if (system.includes('brand identity')) {
        mockResponse = {
          colors: { primary: '#000', secondary: '#fff', accent: '#f00' },
          typography: { headingFont: 'Inter', bodyFont: 'Roboto' }
        };
      } else if (system.includes('branding copywriter')) {
        mockResponse = {
          tone: 'Professional',
          vocabulary: ['sturdy', 'reliable'],
          rules: ['Be direct', 'Be honest'],
        };
      } else if (system.includes('ui/ux designer')) {
        mockResponse = {
          colors: { primary: '#000000', secondary: '#ffffff', accent: '#ff0000', background: '#fafafa', text: '#333333' },
          typography: { headingFont: 'Inter', bodyFont: 'Roboto' },
          spacing: { small: '8px', medium: '16px', large: '32px' },
        };
      } else if (system.includes('seo specialist')) {
        mockResponse = {
          title: 'Contractor Website',
          description: 'Best contractors in town',
          keywords: ['contractor', 'builder'],
          ogImagePlaceholder: 'contractor-working',
        };
      } else if (system.includes('copywriter for home service websites')) {
        const userPrompt = params.messages?.[0]?.content || '';
        const match = userPrompt.match(/Generate content for the (.*?) page/);
        const slug = match ? match[1] : 'test-slug';
        mockResponse = {
          slug: slug,
          sections: [
            { id: 'hero', type: 'hero', content: { headline: 'Welcome', subheadline: 'We build things' } }
          ]
        };
      }

      return {
        text: JSON.stringify(mockResponse),
        usage: { promptTokens: 10, completionTokens: 10 },
      };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('completes the full flow from project creation to generation and deployment', async () => {
    // 1. Create Project
    const createRes = await request(app.getHttpServer())
      .post('/projects')
      .send({ name: 'My Flow Project', industry: 'construction' });
      
    if (createRes.status !== 201) {
      console.error('Create Project Failed:', createRes.body);
    }
    
    expect(createRes.status).toBe(201);
    
    const projectId = createRes.body.id;
    expect(projectId).toBeDefined();

    // 2. Submit Business Context (this will just update the DB)
    const patchRes = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/business-context`)
      .send({
        trade: 'plumber'
      });
      
    if (patchRes.status !== 200) {
      console.error('Patch Business Context Failed:', patchRes.body);
    }
    
    expect(patchRes.status).toBe(200);

    // 3. Trigger Generation
    const triggerRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/generate`)
      .expect(201);
    
    expect(triggerRes.body.message).toContain('queued');

    // 4. Poll database until generation is completed
    let isCompleted = false;
    let attempts = 0;
    while (!isCompleted && attempts < 20) {
      const websiteData = await prisma.websiteData.findUnique({
        where: { projectId },
      });
      if (websiteData?.generationStatus === 'completed') {
        isCompleted = true;
      } else if (websiteData?.generationStatus === 'failed') {
        throw new Error('Generation failed');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
    }
    
    expect(isCompleted).toBe(true);
    expect(aiSpy).toHaveBeenCalled();

    // Verify DB has the generated artifacts
    const finalProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: { websiteData: true, pages: true }
    });

    expect(finalProject?.websiteData?.generationStatus).toBe('completed');
    expect(finalProject?.pages?.length).toBe(3);
  }, 15000); // Increased timeout to 15s to allow queue and AI mocking to finish
});
