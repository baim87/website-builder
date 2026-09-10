import { BusinessContext } from '@prisma/client';

export function buildImagePlannerPrompt(businessContext: Partial<BusinessContext>, pagesToGenerate: string[]): string {
  const businessName = businessContext.businessName || 'Contractor Business';
  const trade = businessContext.trade || 'General Contracting';
  const services = businessContext.services ? JSON.stringify(businessContext.services) : 'No specific services listed';

  return `You are an expert Photography Director for a high-end contractor website (${businessName}, specializing in ${trade}).
Your job is to read the pages we are generating and services offered, and generate a precise shot list (Image Plan) required to populate the website components.

## Rules:
1. Generate exactly ONE Hero image for the main page.
2. For every other page listed in the pages to generate (except 'home' and 'layout'), generate exactly ONE PAGE_HEADER image to act as the top banner background.
3. For each service listed (${services}), generate exactly 4 BEFORE and 4 AFTER image pairs (8 images total per service).
4. Generate 1 General Gallery containing 4-6 diverse architectural shots.
5. VARIETY IS MANDATORY. You must specify diverse camera angles and framing for each shot so they do not look repetitive.
   - Example angles: "Wide shot from doorway", "Low angle looking up at cabinets", "Detail macro shot of quartz countertop edge", "Straight on eye-level wide".
6. Output MUST be an array of JSON objects matching the provided schema.

## Image Subject Framing:
- DO NOT INCLUDE HUMANS in the shots.
- Ensure the 'prompt' describes realistic materials, lighting, and composition.

Pages to generate:
${JSON.stringify(pagesToGenerate, null, 2)}
`;
}
