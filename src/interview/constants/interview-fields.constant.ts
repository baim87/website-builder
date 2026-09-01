export const BUSINESS_FIELDS = [
  'businessName',
  'contactPerson',
  'businessAddress',
  'phone',
  'email',
  'trade',
  'services',
  'serviceAreas',
  'hours',
] as const;

export const BRAND_FIELDS = [
  'brandVoicePreference',
  'primaryColor',
  'secondaryColor',
  'fontStyle',
] as const;

export const REQUIRED_FIELDS = [...BUSINESS_FIELDS, ...BRAND_FIELDS] as const;
