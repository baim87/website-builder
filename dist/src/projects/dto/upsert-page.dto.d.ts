import { z } from 'zod';
export declare const UpsertPageSchema: z.ZodObject<{
    content: z.ZodArray<z.ZodAny>;
    componentCode: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    seoMeta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    keywordTarget: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type UpsertPageDto = z.infer<typeof UpsertPageSchema>;
