import { z } from 'zod';

export const UpdateBusinessContextSchema = z.object({
  businessName: z.string().optional(),
  contactPerson: z.string().optional(),
  businessAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  hours: z.record(z.string(), z.string()).optional(),
  gbpData: z.any().optional(),
  trade: z.string().optional(),
  location: z.string().optional(),
  radius: z.any().optional(),
  services: z.array(z.string()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  brandIdentityInputs: z.record(z.string(), z.any()).optional(),
  brandVoicePreference: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontStyle: z.string().optional(),
  usps: z.array(z.string()).optional(),
  interviewMetadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateBusinessContextDto = z.infer<typeof UpdateBusinessContextSchema>;
