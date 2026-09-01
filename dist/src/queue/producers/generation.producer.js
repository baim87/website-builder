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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationProducer = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const base_producer_1 = require("./base.producer");
const queue_names_constant_1 = require("../../common/constants/queue-names.constant");
let GenerationProducer = class GenerationProducer extends base_producer_1.BaseProducer {
    queue;
    constructor(queue) {
        super();
        this.queue = queue;
    }
    async generateSite(projectId) {
        return this.addJob('generate', { projectId, generateFullSite: true }, { attempts: 3 });
    }
};
exports.GenerationProducer = GenerationProducer;
exports.GenerationProducer = GenerationProducer = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queue_names_constant_1.QUEUE_NAMES.SITE_GENERATION)),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], GenerationProducer);
//# sourceMappingURL=generation.producer.js.map