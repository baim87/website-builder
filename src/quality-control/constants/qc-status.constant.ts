export const QC_STATUS = {
  STANDBY: 'standby',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type QcStatus = typeof QC_STATUS[keyof typeof QC_STATUS];
