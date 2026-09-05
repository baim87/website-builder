export const BUSINESS_FIELDS = [
  'businessName',
  'contactPerson',
  'businessAddress',
  'phone',
  'email',
  'trade',
  'services',
  'location',
  'radius',
  'hours',
] as const;

export const BRAND_FIELDS = [
  'brandVoicePreference',
  'primaryColor',
  'secondaryColor',
  'themePreference',
] as const;

export const REQUIRED_FIELDS = [...BUSINESS_FIELDS, ...BRAND_FIELDS] as const;
