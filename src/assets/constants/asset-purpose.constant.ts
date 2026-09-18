export const ASSET_PURPOSE = {
  LOGO: 'logo',
  FAVICON: 'favicon',
  PORTRAIT: 'portrait',
  PARTNER_BRAND: 'partner_brand',
  UPLOADED_IMAGE: 'Uploaded Image',
  GENERATED_ASSET: 'Generated Asset',
} as const;

export type AssetPurpose = typeof ASSET_PURPOSE[keyof typeof ASSET_PURPOSE];
