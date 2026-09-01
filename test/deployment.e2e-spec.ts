import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DeploymentService } from '../src/deployment/deployment.service';
import { VercelClient } from '../src/vercel/vercel.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { clearDatabase } from './test-utils';

describe('DeploymentService (e2e)', () => {
  let app: INestApplication;
  let deploymentService: DeploymentService;
  let vercelClient: VercelClient;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    deploymentService = app.get(DeploymentService);
    vercelClient = app.get(VercelClient);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    await prisma.user.create({
      data: { id: 'user-deploy', email: 'deploy@example.com', name: 'Deployer' },
    });
    await prisma.project.create({
      data: { id: 'proj-deploy', name: 'Deploy Project', userId: 'user-deploy', status: 'DRAFT' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should deploy a project and add domain via VercelClient', async () => {
    const addDomainSpy = jest.spyOn(vercelClient, 'addDomain').mockResolvedValue(true);
    const revalidateSpy = jest.spyOn(vercelClient, 'revalidate').mockResolvedValue(true);

    const result = await deploymentService.deployProject('proj-deploy', 'user-deploy');

    expect(result.success).toBe(true);
    expect(result.status).toBe('READY');
    expect(result.url).toBe('https://proj-deploy.yourplatform.com');
    expect(result.project.status).toBe('PUBLISHED');

    expect(addDomainSpy).toHaveBeenCalledWith('proj-deploy.yourplatform.com');
    expect(revalidateSpy).toHaveBeenCalledWith('/', 'proj-deploy.yourplatform.com');

    // DB state
    const dbProject = await prisma.project.findUnique({ where: { id: 'proj-deploy' } });
    expect(dbProject?.status).toBe('PUBLISHED');
  });

  it('should get deployment status', async () => {
    const result = await deploymentService.getDeploymentStatus('proj-deploy', 'user-deploy');
    expect(result.ready).toBe(false); // since it's DRAFT
    expect(result.status).toBe('DRAFT');
  });

  it('should throw NotFoundException for invalid project', async () => {
    await expect(deploymentService.deployProject('proj-invalid', 'user-deploy')).rejects.toThrow('Project not found');
  });
});
