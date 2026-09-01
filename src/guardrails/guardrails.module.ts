import { Module } from '@nestjs/common';
import { InputSanitizerService } from './input-sanitizer.service';
import { OutputValidatorService } from './output-validator.service';

import { GuardrailsService } from './guardrails.service';

@Module({
  providers: [InputSanitizerService, OutputValidatorService, GuardrailsService],
  exports: [InputSanitizerService, OutputValidatorService, GuardrailsService],
})
export class GuardrailsModule {}
