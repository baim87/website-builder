import { z } from 'zod';

export const KeywordQuerySchema = z.object({
  trade: z.string().min(1),
  location: z.string().min(1),
});

export type KeywordQueryDto = z.infer<typeof KeywordQuerySchema>;
