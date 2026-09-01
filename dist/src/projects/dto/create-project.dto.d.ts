import { z } from 'zod';
export declare const CreateProjectSchema: z.ZodObject<{
    name: z.ZodString;
    trade: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
