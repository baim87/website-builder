export const TRADES = {
  ROOFING: 'roofing',
  HVAC: 'hvac',
  PLUMBING: 'plumbing',
  ELECTRICAL: 'electrical',
  LANDSCAPING: 'landscaping',
  GENERAL_CONTRACTOR: 'general_contractor',
  PAINTING: 'painting',
  CLEANING: 'cleaning',
  PEST_CONTROL: 'pest_control',
  OTHER: 'other',
} as const;

export type TradeType = typeof TRADES[keyof typeof TRADES];
