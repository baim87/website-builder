"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestJobConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const base_consumer_1 = require("./base.consumer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
let TestJobConsumer = class TestJobConsumer extends base_consumer_1.BaseConsumer {
    async handleJob(job) {
        this.logger.log(`Processing test job with message: ${job.data.message}`);
        if (job.data.fail) {
            throw new Error('Test job configured to fail');
        }
    }
};
exports.TestJobConsumer = TestJobConsumer;
exports.TestJobConsumer = TestJobConsumer = __decorate([
    (0, bullmq_1.Processor)(queue_names_constant_1.QUEUE_NAMES.TEST_JOB)
], TestJobConsumer);
//# sourceMappingURL=test-job.consumer.js.map