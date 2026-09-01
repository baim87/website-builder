"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SkillExecutorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillExecutorService = void 0;
const common_1 = require("@nestjs/common");
const skill_logger_service_1 = require("./skill-logger.service");
const crypto = __importStar(require("crypto"));
let SkillExecutorService = SkillExecutorService_1 = class SkillExecutorService {
    skillLogger;
    logger = new common_1.Logger(SkillExecutorService_1.name);
    constructor(skillLogger) {
        this.skillLogger = skillLogger;
    }
    async executeSkill(skill, input) {
        this.logger.log(`Executing skill ${skill.name} for project ${input.projectId}`);
        const inputHash = crypto.createHash('sha256').update(JSON.stringify(input.context)).digest('hex');
        const startTime = Date.now();
        let status = 'success';
        let outputHash;
        let errorStr;
        let usedModel = 'unknown';
        try {
            const result = await skill.execute(input);
            outputHash = result.hash;
            usedModel = result.model;
            return result.data;
        }
        catch (error) {
            status = 'failed';
            errorStr = error.message;
            this.logger.error(`Skill ${skill.name} failed`, error.stack);
            throw error;
        }
        finally {
            const latencyMs = Date.now() - startTime;
            await this.skillLogger.logInvocation({
                projectId: input.projectId,
                skillType: skill.name,
                inputHash,
                model: usedModel,
                latencyMs,
                outputHash,
                status,
                error: errorStr,
            });
        }
    }
};
exports.SkillExecutorService = SkillExecutorService;
exports.SkillExecutorService = SkillExecutorService = SkillExecutorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [skill_logger_service_1.SkillLoggerService])
], SkillExecutorService);
//# sourceMappingURL=skill-executor.service.js.map