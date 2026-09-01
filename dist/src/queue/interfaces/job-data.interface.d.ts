export interface BaseJobData {
    projectId: string;
}
export interface SiteGenerationJobData extends BaseJobData {
    generateFullSite: boolean;
}
export interface AssetConversionJobData extends BaseJobData {
    assetId: string;
    sourceUrl: string;
}
export interface AnalyticsProvisioningJobData extends BaseJobData {
    domain: string;
}
export interface BillingReconciliationJobData {
    userId?: string;
    subscriptionId?: string;
}
export interface TestJobData {
    message: string;
    fail?: boolean;
}
