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
exports.GenerationConsumer = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const base_consumer_1 = require("./base.consumer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
const generation_service_1 = require("../../generation/generation.service");
let GenerationConsumer = class GenerationConsumer extends base_consumer_1.BaseConsumer {
    generationService;
    constructor(generationService) {
        super();
        this.generationService = generationService;
    }
    async handleJob(job) {
        this.logger.log(`Site generation would happen here for project ${job.data.projectId}`);
        await this.generationService.generateProject(job.data.projectId);
    }
};
exports.GenerationConsumer = GenerationConsumer;
exports.GenerationConsumer = GenerationConsumer = __decorate([
    (0, bullmq_1.Processor)(queue_names_constant_1.QUEUE_NAMES.SITE_GENERATION),
    __metadata("design:paramtypes", [generation_service_1.GenerationService])
], GenerationConsumer);
//# sourceMappingURL=generation.consumer.js.map