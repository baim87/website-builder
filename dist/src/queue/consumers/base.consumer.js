"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
class BaseConsumer extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(this.constructor.name);
    async process(job) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);
        try {
            const result = await this.handleJob(job);
            this.logger.log(`Completed job ${job.id}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Failed job ${job.id}: ${error.message}`, error.stack);
            throw error;
        }
    }
}
exports.BaseConsumer = BaseConsumer;
//# sourceMappingURL=base.consumer.js.map