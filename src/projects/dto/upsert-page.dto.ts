import { z } from 'zod';

export const UpsertPageSchema = z.object({
  content: z.array(z.any()), // Array of sections
  componentCode: z.record(z.string(), z.string()).optional(),
  seoMeta: z.record(z.string(), z.any()).optional(),
  keywordTarget: z.record(z.string(), z.any()).optional(),
});

export type UpsertPageDto = z.infer<typeof UpsertPageSchema>;
