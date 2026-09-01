import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  trade: z.string().optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
