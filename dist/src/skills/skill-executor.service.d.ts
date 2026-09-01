import { Skill, SkillInput } from './interfaces/skill.interface';
import { SkillLoggerService } from './skill-logger.service';
export declare class SkillExecutorService {
    private readonly skillLogger;
    private readonly logger;
    constructor(skillLogger: SkillLoggerService);
    executeSkill(skill: Skill, input: SkillInput): Promise<any>;
}
