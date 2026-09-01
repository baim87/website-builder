import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput } from './interfaces/skill.interface';
import { SkillLoggerService } from './skill-logger.service';
import * as crypto from 'crypto';

@Injectable()
export class SkillExecutorService {
  private readonly logger = new Logger(SkillExecutorService.name);

  constructor(private readonly skillLogger: SkillLoggerService) {}

  async executeSkill(skill: Skill, input: SkillInput) {
    this.logger.log(`Executing skill ${skill.name} for project ${input.projectId}`);
    
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(input.context)).digest('hex');
    const startTime = Date.now();
    let status: 'success' | 'failed' = 'success';
    let outputHash: string | undefined;
    let errorStr: string | undefined;
    let usedModel = 'unknown';

    try {
      const result = await skill.execute(input);
      outputHash = result.hash;
      usedModel = result.model;
      return result.data;
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
        latencyMs,
        outputHash,
        status,
        error: errorStr,
      });
    }
  }
}
