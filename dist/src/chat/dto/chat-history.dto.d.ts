import { z } from 'zod';
export declare const ChatHistorySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ChatHistoryDto = z.infer<typeof ChatHistorySchema>;
