export const GENERATION_STATUS = {
  PENDING: 'pending',
  COMPONENTS: 'components',
  PAGES: 'pages',
  DEPLOYING: 'deploying',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS];
