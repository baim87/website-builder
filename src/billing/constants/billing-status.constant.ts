export const BILLING_STATUS = {
  ACTIVE: 'active',
  NONE: 'none',
  SUCCEEDED: 'succeeded',
} as const;

export type BillingStatus = typeof BILLING_STATUS[keyof typeof BILLING_STATUS];
