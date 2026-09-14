export const ANALYTICS_STATUS = {
  NOT_PROVISIONED: 'NOT_PROVISIONED',
  ACTIVE: 'ACTIVE',
  ACCEPTED: 'ACCEPTED',
} as const;

export type AnalyticsStatus = typeof ANALYTICS_STATUS[keyof typeof ANALYTICS_STATUS];
