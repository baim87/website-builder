import { z } from 'zod';

export const BrandInterviewInputsSchema = z.object({
  targetAudience: z.array(z.string()).optional(),
  desiredSegments: z.array(z.string()).optional(),
  customerFears: z.array(z.string()).optional(),
  corePromise: z.string().optional(),
  differentiators: z.array(z.string()).optional(),
  proofPoints: z.array(z.string()).optional(),
  brandPersonality: z.array(z.string()).max(5).optional(),
  competitors: z.string().optional(),
  companyAmbition: z.string().optional(),
  founderStory: z.string().optional(),
  visualDirection: z.string().optional(),
  colorPreferences: z.string().optional(),
  existingLogoFeedback: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  themePreference: z.string().optional(),
  extractedBrand: z.any().optional(),
});

export const UpdateBusinessContextSchema = z.object({
  businessName: z.string().optional(),
  contactPerson: z.string().optional(),
  businessAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  hours: z.union([z.record(z.string(), z.string()), z.array(z.string())]).optional(),
  gbpData: z.any().optional(),
  trade: z.string().optional(),
  location: z.string().optional(),
  radius: z.union([z.string(), z.number()]).optional(),
  services: z.array(z.string()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  brandIdentityInputs: BrandInterviewInputsSchema.optional(),
  brandVoicePreference: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  themePreference: z.string().optional(),
  usps: z.array(z.string()).optional(),
  interviewMetadata: z.record(z.string(), z.any()).optional(),
});

export type UpdateBusinessContextDto = z.infer<typeof UpdateBusinessContextSchema>;
