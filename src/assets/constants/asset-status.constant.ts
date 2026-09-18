export const ASSET_STATUS = {
  PENDING: 'pending',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SUCCESS: 'success', // Kept for backwards compatibility if any, but mapping to completed conceptually
} as const;

export type AssetStatus = typeof ASSET_STATUS[keyof typeof ASSET_STATUS];
