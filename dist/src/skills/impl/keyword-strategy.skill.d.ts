import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
import { KeywordsService } from '../../keywords/keywords.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class KeywordStrategySkill implements Skill {
    private readonly aiGateway;
    private readonly keywordsService;
    private readonly prisma;
    private readonly validator;
    readonly name = "KeywordStrategy";
    private readonly logger;
    constructor(aiGateway: AIGatewayService, keywordsService: KeywordsService, prisma: PrismaService, validator: OutputValidatorService);
    execute(input: SkillInput): Promise<SkillOutput>;
}
