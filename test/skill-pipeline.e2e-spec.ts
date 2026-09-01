import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { OrchestratorService } from '../src/skills/orchestrator.service';
import { AIGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';

describe('Skill Pipeline (e2e)', () => {
  let app: INestApplication;
  let orchestrator: OrchestratorService;
  let aiGateway: AIGatewayService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    orchestrator = app.get<OrchestratorService>(OrchestratorService);
    aiGateway = app.get<AIGatewayService>(AIGatewayService);
  });

  beforeEach(async () => {
    const prisma = app.get(PrismaService);
    await clearDatabase(prisma);
    await prisma.user.create({
      data: { id: 'user-1', email: 'test@example.com', name: 'Tester' },
    });
    await prisma.project.create({
      data: { id: 'proj-123', name: 'Test Project', userId: 'user-1' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes the full 3-phase generation pipeline successfully', async () => {
    const aiSpy = jest.spyOn(aiGateway, 'generateText').mockImplementation(async (model, params) => {
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
        mockResponse = {
          slug: 'test-slug',
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

    const result = await orchestrator.generateWebsite('proj-123', { industry: 'construction' });

    expect(aiSpy).toHaveBeenCalled();
    expect(result.brandVoice).toBeDefined();
    expect(result.designTokens).toBeDefined();
    expect(result.seoMetadata).toBeDefined();
    expect(result.pages.length).toBe(3); // home, about-us, services
    
    // Verify parallel page generation was successful
    expect(result.pages[0].sections[0].content.headline).toBe('Welcome');

    aiSpy.mockRestore();
  });
  
  it('handles partial failures during page generation without crashing the pipeline', async () => {
    let callCount = 0;
    const aiSpy = jest.spyOn(aiGateway, 'generateText').mockImplementation(async (model, params) => {
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
        callCount++;
        if (callCount === 2) {
          // Simulate failure for the second page
          throw new Error('LLM timeout');
        }
        mockResponse = {
          slug: 'test-slug',
          sections: []
        };
      }

      return {
        text: JSON.stringify(mockResponse),
        usage: { promptTokens: 10, completionTokens: 10 },
      };
    });

    const result = await orchestrator.generateWebsite('proj-123', { industry: 'construction' });

    // Since 1 of the 3 pages failed, only 2 should be in the final result
    expect(result.pages.length).toBe(2);

    aiSpy.mockRestore();
  });
});
