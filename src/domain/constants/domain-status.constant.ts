export const DOMAIN_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;

export type DomainStatus = typeof DOMAIN_STATUS[keyof typeof DOMAIN_STATUS];
