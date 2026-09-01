import { z } from 'zod';
export declare const KeywordQuerySchema: z.ZodObject<{
    trade: z.ZodString;
    location: z.ZodString;
}, z.core.$strip>;
export type KeywordQueryDto = z.infer<typeof KeywordQuerySchema>;
