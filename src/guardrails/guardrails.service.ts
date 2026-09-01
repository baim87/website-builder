import { Injectable } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { InputSanitizerService } from './input-sanitizer.service';
import { OutputValidatorService } from './output-validator.service';

@Injectable()
export class GuardrailsService {
  constructor(
    private readonly inputSanitizer: InputSanitizerService,
    private readonly outputValidator: OutputValidatorService,
  ) {}

  validateInput(input: string): string {
    return this.inputSanitizer.sanitize(input);
  }

  validateOutput<T>(output: any, schema: ZodSchema<T>): T {
    return this.outputValidator.validate(output, schema);
  }
}
