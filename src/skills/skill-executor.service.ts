import { Injectable } from '@nestjs/common';
import { Skill, SkillInput } from './interfaces/skill.interface';
import { SkillLoggerService } from './skill-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { SKILL_STATUS, SkillStatus } from './constants/skill-status.constant';

@Injectable()
export class SkillExecutorService {
  constructor(
    private readonly skillLogger: SkillLoggerService,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly cls: ClsService
  ) {
    this.logger.setContext(SkillExecutorService.name);
  }

  async executeSkill(skill: Skill, input: SkillInput) {
    this.logger.info(`Executing skill ${skill.name} for project ${input.projectId}`);
    
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(input.context)).digest('hex');

    // Check Cache
    const cached = await this.prisma.skillInvocation.findFirst({
      where: {
        projectId: input.projectId,
        skillType: skill.name,
        inputHash,
        status: SKILL_STATUS.SUCCESS
      },
      orderBy: { createdAt: 'desc' }
    });

    if (cached && cached.outputData) {
      this.logger.info(`Cache hit for skill ${skill.name} (Project: ${input.projectId})`);
      return cached.outputData;
    }

    const startTime = Date.now();
    let status: SkillStatus = SKILL_STATUS.SUCCESS;
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
      status = SKILL_STATUS.FAILED;
      errorStr = error.message;
      this.logger.error({ err: error }, `Skill ${skill.name} failed`);
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;

      let previewStr = '';
      if (outputData) {
        const fullStr = JSON.stringify(outputData);
        previewStr = fullStr.length > 500 ? fullStr.substring(0, 500) + '... (truncated)' : fullStr;
      }
      
      this.logger.info({
        skill: skill.name,
        latencyMs,
        cost: usage?.cost,
        tokens: usage?.promptTokens ? usage.promptTokens + usage.completionTokens : undefined,
        status,
        preview: previewStr
      }, `Skill ${skill.name} receipt`);

      const userId = this.cls.get('userId');
      const traceId = this.cls.get('traceId');

      await this.skillLogger.logInvocation({
        projectId: input.projectId,
        userId,
        traceId,
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
