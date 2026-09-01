export interface SkillInput {
  projectId: string;
  context: any;
}

export interface SkillOutput {
  data: any;
  hash: string;
  model: string;
}

export interface Skill {
  readonly name: string;
  execute(input: SkillInput): Promise<SkillOutput>;
}
