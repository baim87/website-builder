import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      if (metadata.type !== 'body') {
         return value;
      }
      return this.schema.parse(value);
    } catch (error: any) {
      if (error.errors) {
        throw new BadRequestException(error.errors);
      }
      console.error('ZodValidationPipe caught non-Zod error:', error);
      throw new BadRequestException('Validation failed');
    }
  }
}
