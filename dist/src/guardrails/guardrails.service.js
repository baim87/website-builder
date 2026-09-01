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
exports.GuardrailsService = void 0;
const common_1 = require("@nestjs/common");
const input_sanitizer_service_1 = require("./input-sanitizer.service");
const output_validator_service_1 = require("./output-validator.service");
let GuardrailsService = class GuardrailsService {
    inputSanitizer;
    outputValidator;
    constructor(inputSanitizer, outputValidator) {
        this.inputSanitizer = inputSanitizer;
        this.outputValidator = outputValidator;
    }
    validateInput(input) {
        return this.inputSanitizer.sanitize(input);
    }
    validateOutput(output, schema) {
        return this.outputValidator.validate(output, schema);
    }
};
exports.GuardrailsService = GuardrailsService;
exports.GuardrailsService = GuardrailsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [input_sanitizer_service_1.InputSanitizerService,
        output_validator_service_1.OutputValidatorService])
], GuardrailsService);
//# sourceMappingURL=guardrails.service.js.map