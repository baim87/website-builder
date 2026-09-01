import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillLoggerService {
  private readonly logger = new Logger(SkillLoggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logInvocation(params: {
    projectId: string;
    skillType: string;
    inputHash: string;
    model: string;
    tokens?: number;
    latencyMs?: number;
    outputHash?: string;
    status: 'success' | 'failed';
    error?: string;
  }) {
    this.logger.log(`Logging skill invocation for ${params.skillType} on project ${params.projectId}`);
    return this.prisma.skillInvocation.create({
      data: params,
    });
  }
}
