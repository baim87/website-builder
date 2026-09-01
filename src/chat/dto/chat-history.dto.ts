import { z } from 'zod';

export const ChatHistorySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type ChatHistoryDto = z.infer<typeof ChatHistorySchema>;
