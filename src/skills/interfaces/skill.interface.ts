import { UsageMetrics } from '../../ai-gateway/interfaces/ai-gateway.types';

export interface SkillInput {
  projectId: string;
  context: any;
  metadata?: any;
}

export interface SkillOutput {
  data: any;
  hash: string;
  model: string;
  usage?: UsageMetrics;
}

export interface Skill {
  readonly name: string;
  execute(input: SkillInput): Promise<SkillOutput>;
}
