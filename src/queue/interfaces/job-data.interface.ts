export interface BaseJobData {
  projectId: string;
  userId: string;
}

export interface SiteGenerationJobData extends BaseJobData {
  generateFullSite: boolean;
}

export interface ImageGenerationJobData extends BaseJobData {
  projectAssetId: string;
}

export interface AssetConversionJobData extends BaseJobData {
  assetId: string;
  sourceUrl: string;
}

export interface AnalyticsProvisioningJobData extends BaseJobData {
  domain: string;
}

export interface QualityControlJobData extends BaseJobData {
  vercelUrl: string;
  businessType: string;
  retryCount: number;
}

export interface BillingReconciliationJobData {
  userId?: string;
  subscriptionId?: string;
}

export interface TestJobData {
  message: string;
  fail?: boolean;
}
