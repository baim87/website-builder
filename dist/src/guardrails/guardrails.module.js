"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardrailsModule = void 0;
const common_1 = require("@nestjs/common");
const input_sanitizer_service_1 = require("./input-sanitizer.service");
const output_validator_service_1 = require("./output-validator.service");
const guardrails_service_1 = require("./guardrails.service");
let GuardrailsModule = class GuardrailsModule {
};
exports.GuardrailsModule = GuardrailsModule;
exports.GuardrailsModule = GuardrailsModule = __decorate([
    (0, common_1.Module)({
        providers: [input_sanitizer_service_1.InputSanitizerService, output_validator_service_1.OutputValidatorService, guardrails_service_1.GuardrailsService],
        exports: [input_sanitizer_service_1.InputSanitizerService, output_validator_service_1.OutputValidatorService, guardrails_service_1.GuardrailsService],
    })
], GuardrailsModule);
//# sourceMappingURL=guardrails.module.js.map