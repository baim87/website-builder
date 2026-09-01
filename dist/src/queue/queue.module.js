"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const queue_names_constant_1 = require("../common/constants/queue-names.constant");
const generation_producer_1 = require("./producers/generation.producer");
const asset_conversion_producer_1 = require("./producers/asset-conversion.producer");
const generation_consumer_1 = require("./consumers/generation.consumer");
const asset_conversion_consumer_1 = require("./consumers/asset-conversion.consumer");
const analytics_provisioning_consumer_1 = require("./consumers/analytics-provisioning.consumer");
const billing_reconciliation_consumer_1 = require("./consumers/billing-reconciliation.consumer");
const test_job_consumer_1 = require("./consumers/test-job.consumer");
const analytics_provisioning_producer_1 = require("./producers/analytics-provisioning.producer");
const billing_reconciliation_producer_1 = require("./producers/billing-reconciliation.producer");
const test_job_producer_1 = require("./producers/test-job.producer");
const generation_module_1 = require("../generation/generation.module");
const assets_module_1 = require("../assets/assets.module");
const storage_module_1 = require("../storage/storage.module");
const prisma_module_1 = require("../prisma/prisma.module");
const billing_module_1 = require("../billing/billing.module");
const analytics_module_1 = require("../analytics/analytics.module");
const common_2 = require("@nestjs/common");
const consumers = process.env.APP_MODE !== 'api'
    ? [
        generation_consumer_1.GenerationConsumer,
        asset_conversion_consumer_1.AssetConversionConsumer,
        analytics_provisioning_consumer_1.AnalyticsProvisioningConsumer,
        billing_reconciliation_consumer_1.BillingReconciliationConsumer,
        test_job_consumer_1.TestJobConsumer,
    ]
    : [];
const producers = [
    generation_producer_1.GenerationProducer,
    asset_conversion_producer_1.AssetConversionProducer,
    analytics_provisioning_producer_1.AnalyticsProvisioningProducer,
    billing_reconciliation_producer_1.BillingReconciliationProducer,
    test_job_producer_1.TestJobProducer,
];
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            generation_module_1.GenerationModule,
            (0, common_2.forwardRef)(() => assets_module_1.AssetsModule),
            storage_module_1.StorageModule,
            prisma_module_1.PrismaModule,
            billing_module_1.BillingModule,
            (0, common_2.forwardRef)(() => analytics_module_1.AnalyticsModule),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        url: config.get('REDIS_URL'),
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({
                name: queue_names_constant_1.QUEUE_NAMES.SITE_GENERATION,
            }),
            bullmq_1.BullModule.registerQueue({
                name: queue_names_constant_1.QUEUE_NAMES.ASSET_CONVERSION,
            }),
            bullmq_1.BullModule.registerQueue({
                name: queue_names_constant_1.QUEUE_NAMES.ANALYTICS_PROVISIONING,
            }),
            bullmq_1.BullModule.registerQueue({
                name: queue_names_constant_1.QUEUE_NAMES.BILLING_RECONCILIATION,
            }),
            bullmq_1.BullModule.registerQueue({
                name: queue_names_constant_1.QUEUE_NAMES.TEST_JOB,
            }),
        ],
        providers: [
            ...producers,
            ...consumers,
        ],
        exports: [
            ...producers,
        ],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map