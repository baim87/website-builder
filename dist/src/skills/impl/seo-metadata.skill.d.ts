import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { OutputValidatorService } from '../../guardrails/output-validator.service';
export declare class SeoMetadataSkill implements Skill {
    private readonly aiGateway;
    private readonly validator;
    readonly name = "SeoMetadata";
    private readonly logger;
    constructor(aiGateway: AIGatewayService, validator: OutputValidatorService);
    execute(input: SkillInput): Promise<SkillOutput>;
}
