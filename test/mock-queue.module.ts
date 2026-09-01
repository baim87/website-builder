import { Module } from '@nestjs/common';
import { GenerationProducer } from '../src/queue/producers/generation.producer';
import { AssetConversionProducer } from '../src/queue/producers/asset-conversion.producer';
import { AnalyticsProvisioningProducer } from '../src/queue/producers/analytics-provisioning.producer';
import { BillingReconciliationProducer } from '../src/queue/producers/billing-reconciliation.producer';
import { TestJobProducer } from '../src/queue/producers/test-job.producer';

const mockProducer = {
  addJob: jest.fn(),
  provisionAnalytics: jest.fn(),
  reconcileBilling: jest.fn(),
  generateFullSite: jest.fn(),
};

@Module({
  providers: [
    { provide: GenerationProducer, useValue: mockProducer },
    { provide: AssetConversionProducer, useValue: mockProducer },
    { provide: AnalyticsProvisioningProducer, useValue: mockProducer },
    { provide: BillingReconciliationProducer, useValue: mockProducer },
    { provide: TestJobProducer, useValue: mockProducer },
  ],
  exports: [
    GenerationProducer,
    AssetConversionProducer,
    AnalyticsProvisioningProducer,
    BillingReconciliationProducer,
    TestJobProducer,
  ],
})
export class MockQueueModule {}
