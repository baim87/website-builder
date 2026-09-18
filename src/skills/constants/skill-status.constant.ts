export const SKILL_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type SkillStatus = typeof SKILL_STATUS[keyof typeof SKILL_STATUS];
