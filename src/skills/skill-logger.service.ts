import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SkillLoggerService {
  constructor(private readonly prisma: PrismaService, private readonly logger: PinoLogger) {
    this.logger.setContext(SkillLoggerService.name);
  }

  async logInvocation(params: {
    projectId: string;
    userId?: string;
    traceId?: string;
    skillType: string;
    inputHash: string;
    model: string;
    tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    cost?: number;
    metadata?: any;
    latencyMs?: number;
    outputHash?: string;
    outputData?: any;
    status: 'success' | 'failed';
    error?: string;
  }) {
    this.logger.info(`Logging skill invocation for ${params.skillType} on project ${params.projectId}`);
    return this.prisma.skillInvocation.create({
      data: params,
    });
  }
}
