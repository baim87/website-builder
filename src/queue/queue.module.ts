import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';
import { GenerationProducer } from './producers/generation.producer';
import { AssetConversionProducer } from './producers/asset-conversion.producer';
import { GenerationConsumer } from './consumers/generation.consumer';
import { AssetConversionConsumer } from './consumers/asset-conversion.consumer';
import { AnalyticsProvisioningConsumer } from './consumers/analytics-provisioning.consumer';
import { BillingReconciliationConsumer } from './consumers/billing-reconciliation.consumer';
import { TestJobConsumer } from './consumers/test-job.consumer';
import { AnalyticsProvisioningProducer } from './producers/analytics-provisioning.producer';
import { BillingReconciliationProducer } from './producers/billing-reconciliation.producer';
import { TestJobProducer } from './producers/test-job.producer';
import { QualityControlProducer } from './producers/quality-control.producer';
import { QualityControlConsumer } from './consumers/quality-control.consumer';
import { GenerationModule } from '../generation/generation.module';
import { AssetsModule } from '../assets/assets.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { QualityControlModule } from '../quality-control/quality-control.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { forwardRef } from '@nestjs/common';

const consumers = process.env.APP_MODE !== 'api'
  ? [
      GenerationConsumer,
      AssetConversionConsumer,
      AnalyticsProvisioningConsumer,
      BillingReconciliationConsumer,
      TestJobConsumer,
      QualityControlConsumer,
    ]
  : [];

const producers = [
  GenerationProducer,
  AssetConversionProducer,
  AnalyticsProvisioningProducer,
  BillingReconciliationProducer,
  TestJobProducer,
  QualityControlProducer,
];

@Module({
  imports: [
    forwardRef(() => GenerationModule),
    forwardRef(() => AssetsModule),
    StorageModule,
    PrismaModule,
    BillingModule,
    forwardRef(() => AnalyticsModule),
    forwardRef(() => DeploymentModule),
    QualityControlModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.SITE_GENERATION,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.ASSET_CONVERSION,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.ANALYTICS_PROVISIONING,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.BILLING_RECONCILIATION,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.TEST_JOB,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.QUALITY_CONTROL,
    }),
    // Other queues registered here...
  ],
  providers: [
    ...producers,
    ...consumers,
  ],
  exports: [
    ...producers,
  ],
})
export class QueueModule {}
