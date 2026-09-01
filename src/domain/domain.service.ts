import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VercelClient } from '../vercel/vercel.client';

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelClient: VercelClient,
  ) {}

  async searchDomain(query: string) {
    this.logger.log(`Searching domain: ${query}`);
    
    // We can directly pass this to the VercelClient
    const result = await this.vercelClient.checkDomainPrice(query);
    
    return {
      domainName: query,
      available: result.available || false,
      price: result.price,
      period: result.period,
    };
  }

  async purchaseDomain(projectId: string, userId: string, domainName: string, expectedPrice: number) {
    this.logger.log(`Purchasing domain ${domainName} for project ${projectId} (User: ${userId})`);

    // 1. Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.domain) {
      throw new BadRequestException('Project already has a primary domain. Please remove it first to buy a new one.');
    }

    // 2. Perform availability check again just to be safe
    const check = await this.vercelClient.checkDomainPrice(domainName);
    if (!check.available) {
      throw new BadRequestException('Domain is no longer available');
    }

    if (check.price !== expectedPrice) {
      throw new BadRequestException(`Price mismatch. Expected ${expectedPrice}, got ${check.price}`);
    }

    // 3. Purchase the domain via Vercel Client (Mocked in dev automatically)
    const purchaseResult = await this.vercelClient.buyDomain(domainName, expectedPrice);

    // 4. Attach domain to the master Vercel project
    await this.vercelClient.addDomain(domainName);

    // 5. Persist the Domain to our database
    const domainRecord = await this.prisma.domain.create({
      data: {
        projectId,
        domainName,
        provider: 'VERCEL',
        status: 'ACTIVE',
      },
    });

    return {
      success: true,
      domain: domainRecord,
      mocked: purchaseResult.mocked || false,
    };
  }
}
