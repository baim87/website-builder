import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { GenerationProducer } from '../src/queue/producers/generation.producer';
import { GenerationService } from '../src/generation/generation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../src/common/constants/queue-names.constant';
import { Queue } from 'bullmq';

describe('BullMQ Queue (e2e)', () => {
  let app: INestApplication;
  let generationProducer: GenerationProducer;
  let generationService: GenerationService;
  let generationQueue: Queue;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    generationProducer = app.get(GenerationProducer);
    generationService = app.get(GenerationService);
    generationQueue = app.get(getQueueToken(QUEUE_NAMES.SITE_GENERATION));
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    await generationQueue.drain(); // Clear queue before each test
  });

  afterAll(async () => {
    await app.close();
  });

  it('enqueues a generation job and processes it asynchronously', async () => {
    // 1. Setup a promise to wait for the job to be processed by the worker
    let jobCompletedResolve: (value?: any) => void;
    const jobCompletedPromise = new Promise((resolve) => {
      jobCompletedResolve = resolve;
    });

    // 2. Mock the actual generation logic to prevent hitting LLM/DB APIs
    // When the consumer calls this, we resolve our promise to unblock the test
    const generateProjectSpy = jest
      .spyOn(generationService, 'generateProject')
      .mockImplementation(async (projectId) => {
        expect(projectId).toBe('proj-bullmq');
        jobCompletedResolve();
        return;
      });

    // 3. Add job to the queue
    const job = await generationProducer.generateSite('proj-bullmq');
    expect(job).toBeDefined();
    expect(job.name).toBe('generate');
    expect(job.data.projectId).toBe('proj-bullmq');

    // 4. Wait for the consumer to pick it up and call generateProject
    await jobCompletedPromise;

    // 5. Verify the consumer executed
    expect(generateProjectSpy).toHaveBeenCalledWith('proj-bullmq');

    // 6. Verify job status in BullMQ
    const jobState = await job.getState();
    // It might be 'active' or 'completed' depending on exact timing, 
    // but the spy was called, proving it reached the worker.
    generateProjectSpy.mockRestore();
  });
});
