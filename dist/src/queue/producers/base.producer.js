"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProducer = void 0;
const common_1 = require("@nestjs/common");
class BaseProducer {
    logger = new common_1.Logger(this.constructor.name);
    async addJob(jobName, data, opts) {
        this.logger.log(`Enqueuing job [${jobName}] to queue ${this.queue.name}`);
        return this.queue.add(jobName, data, opts);
    }
}
exports.BaseProducer = BaseProducer;
//# sourceMappingURL=base.producer.js.map