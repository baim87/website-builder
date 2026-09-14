export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
