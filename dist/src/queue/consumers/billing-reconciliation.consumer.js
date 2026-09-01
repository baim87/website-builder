"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingReconciliationConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const base_consumer_1 = require("./base.consumer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
const billing_service_1 = require("../../billing/billing.service");
let BillingReconciliationConsumer = class BillingReconciliationConsumer extends base_consumer_1.BaseConsumer {
    billingService;
    constructor(billingService) {
        super();
        this.billingService = billingService;
    }
    async handleJob(job) {
        if (job.name === 'reconcile-all') {
            await this.billingService.reconcileAllSubscriptions();
        }
        else if (job.name === 'reconcile') {
            if (job.data.userId && job.data.subscriptionId) {
                await this.billingService.reconcileBilling(job.data.userId, job.data.subscriptionId);
            }
        }
    }
};
exports.BillingReconciliationConsumer = BillingReconciliationConsumer;
exports.BillingReconciliationConsumer = BillingReconciliationConsumer = __decorate([
    (0, bullmq_1.Processor)(queue_names_constant_1.QUEUE_NAMES.BILLING_RECONCILIATION),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingReconciliationConsumer);
//# sourceMappingURL=billing-reconciliation.consumer.js.map