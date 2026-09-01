import { z } from 'zod';

export const SendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
