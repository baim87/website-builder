import { z } from 'zod';
export declare const SendMessageSchema: z.ZodObject<{
    content: z.ZodString;
}, z.core.$strip>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
