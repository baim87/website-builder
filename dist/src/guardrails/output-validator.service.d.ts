import { ZodSchema } from 'zod';
export declare class OutputValidatorService {
    private readonly logger;
    validate<T>(output: any, schema: ZodSchema<T>): T;
    private deepValidateScope;
    validateKeywordPresence(title: string, h1: string, primaryKeyword: string): void;
    validateComponentCode(code: string): void;
    validateCSS(css: string): void;
    groundCheckContent(content: any, businessContext: any): void;
}
