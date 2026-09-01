import { ZodSchema } from 'zod';
export declare class OutputValidatorService {
    private readonly logger;
    validate<T>(output: any, schema: ZodSchema<T>): T;
    private deepValidateScope;
}
