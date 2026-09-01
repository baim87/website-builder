import { ZodSchema } from 'zod';
import { InputSanitizerService } from './input-sanitizer.service';
import { OutputValidatorService } from './output-validator.service';
export declare class GuardrailsService {
    private readonly inputSanitizer;
    private readonly outputValidator;
    constructor(inputSanitizer: InputSanitizerService, outputValidator: OutputValidatorService);
    validateInput(input: string): string;
    validateOutput<T>(output: any, schema: ZodSchema<T>): T;
}
