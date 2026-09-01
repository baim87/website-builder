import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import type { ZodSchema } from 'zod';
export declare class ZodValidationPipe implements PipeTransform {
    private schema;
    constructor(schema: ZodSchema<any>);
    transform(value: any, metadata: ArgumentMetadata): any;
}
