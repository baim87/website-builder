export const PROJECT_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  PREVIEW: 'preview',
  LIVE: 'live',
  ARCHIVED: 'archived',
} as const;

export type ProjectStatusType = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
