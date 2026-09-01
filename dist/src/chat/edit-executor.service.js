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
var EditExecutorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditExecutorService = void 0;
const common_1 = require("@nestjs/common");
const website_data_service_1 = require("../projects/website-data.service");
const generation_producer_1 = require("../queue/producers/generation.producer");
let EditExecutorService = EditExecutorService_1 = class EditExecutorService {
    websiteDataService;
    generationProducer;
    logger = new common_1.Logger(EditExecutorService_1.name);
    constructor(websiteDataService, generationProducer) {
        this.websiteDataService = websiteDataService;
        this.generationProducer = generationProducer;
    }
    async applyEdits(projectId, intent, currentWebsiteData) {
        if (!intent.changes || intent.changes.length === 0) {
            return;
        }
        const updatedData = { ...currentWebsiteData };
        const topLevelUpdates = {};
        for (const change of intent.changes) {
            const keys = change.path.split('.');
            const topLevelKey = keys[0];
            let current = updatedData;
            for (let i = 0; i < keys.length - 1; i++) {
                if (current[keys[i]] === undefined || current[keys[i]] === null) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = change.value;
            topLevelUpdates[topLevelKey] = updatedData[topLevelKey];
        }
        if (Object.keys(topLevelUpdates).length > 0) {
            this.logger.log(`Persisting edit changes for project ${projectId}`);
            await this.websiteDataService.upsert(projectId, topLevelUpdates);
        }
        if (intent.triggerRegeneration) {
            this.logger.log(`Queuing site regeneration for project ${projectId}`);
            await this.generationProducer.generateSite(projectId);
        }
    }
};
exports.EditExecutorService = EditExecutorService;
exports.EditExecutorService = EditExecutorService = EditExecutorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [website_data_service_1.WebsiteDataService,
        generation_producer_1.GenerationProducer])
], EditExecutorService);
//# sourceMappingURL=edit-executor.service.js.map