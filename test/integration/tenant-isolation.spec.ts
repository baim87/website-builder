import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { tenantContext } from '../../src/prisma/prisma-tenant.middleware';
import { AppModule } from '../../src/app.module';
import { INestApplication } from '@nestjs/common';

describe('Tenant Isolation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should isolate queries between tenants', async () => {
    // 1. Create two users
    const userA = await prisma.user.create({
      data: { email: 'usera@test.com', name: 'User A', googleId: '1' },
    });
    const userB = await prisma.user.create({
      data: { email: 'userb@test.com', name: 'User B', googleId: '2' },
    });

    // 2. Create a project for User A
    const projectA = await prisma.project.create({
      data: {
        name: 'Project A',
        userId: userA.id,
      },
    });

    // 3. User B should not be able to find User A's project when tenantContext is active
    let foundProject = null;
    await new Promise<void>((resolve) => {
      tenantContext.run({ userId: userB.id }, async () => {
        foundProject = await prisma.project.findUnique({
          where: { id: projectA.id },
        });
        resolve();
      });
    });

    // Expect not found because of tenant middleware filtering
    expect(foundProject).toBeNull();
  });
});
