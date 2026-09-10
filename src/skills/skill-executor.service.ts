import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput } from './interfaces/skill.interface';
import { SkillLoggerService } from './skill-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SkillExecutorService {
  private readonly logger = new Logger(SkillExecutorService.name);

  constructor(
    private readonly skillLogger: SkillLoggerService,
    private readonly prisma: PrismaService
  ) {}

  async executeSkill(skill: Skill, input: SkillInput) {
    this.logger.log(`Executing skill ${skill.name} for project ${input.projectId}`);
    
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(input.context)).digest('hex');

    // Check Cache
    const cached = await this.prisma.skillInvocation.findFirst({
      where: {
        projectId: input.projectId,
        skillType: skill.name,
        inputHash,
        status: 'success'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cached && cached.outputData) {
      this.logger.log(`Cache hit for skill ${skill.name} (Project: ${input.projectId})`);
      return cached.outputData;
    }

    const startTime = Date.now();
    let status: 'success' | 'failed' = 'success';
    let outputHash: string | undefined;
    let outputData: any | undefined;
    let errorStr: string | undefined;
    let usedModel = 'unknown';
    let usage: any;

    try {
      const result = await skill.execute(input);
      outputHash = result.hash;
      outputData = result.data;
      usedModel = result.model;
      usage = result.usage;
      return outputData;
    } catch (error: any) {
      status = 'failed';
      errorStr = error.message;
      this.logger.error(`Skill ${skill.name} failed`, error.stack);
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      await this.skillLogger.logInvocation({
        projectId: input.projectId,
        skillType: skill.name,
        inputHash,
        model: usedModel,
        tokens: usage?.promptTokens ? usage.promptTokens + usage.completionTokens : undefined,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        cost: usage?.cost,
        metadata: input.metadata,
        latencyMs,
        outputHash,
        outputData,
        status,
        error: errorStr,
      });
    }
  }
}
