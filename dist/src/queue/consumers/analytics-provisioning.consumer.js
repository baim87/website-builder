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
exports.AnalyticsProvisioningConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const base_consumer_1 = require("./base.consumer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
const analytics_service_1 = require("../../analytics/analytics.service");
let AnalyticsProvisioningConsumer = class AnalyticsProvisioningConsumer extends base_consumer_1.BaseConsumer {
    analyticsService;
    constructor(analyticsService) {
        super();
        this.analyticsService = analyticsService;
    }
    async handleJob(job) {
        await this.analyticsService.provisionAnalytics(job.data.projectId, job.data.domain);
    }
};
exports.AnalyticsProvisioningConsumer = AnalyticsProvisioningConsumer;
exports.AnalyticsProvisioningConsumer = AnalyticsProvisioningConsumer = __decorate([
    (0, bullmq_1.Processor)(queue_names_constant_1.QUEUE_NAMES.ANALYTICS_PROVISIONING),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsProvisioningConsumer);
//# sourceMappingURL=analytics-provisioning.consumer.js.map