import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class CopyWriterSkill implements Skill {
    private readonly aiGateway;
    private readonly validator;
    private readonly prisma;
    readonly name = "CopyWriter";
    private readonly logger;
    constructor(aiGateway: AIGatewayService, validator: OutputValidatorService, prisma: PrismaService);
    execute(input: SkillInput): Promise<SkillOutput>;
}
