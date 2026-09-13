import { THEME_DEFINITIONS } from '../../constants/theme-definitions.constant';

const isSkipped = (val: any): boolean =>
  !val || (typeof val === 'string' && val.trim().toLowerCase() === 'skip');

export function buildBrandVisualPrompt(
  businessContext: any,
  brandStrategy: string,
  extractedBrand?: any,
): string {
  const brandInputs = businessContext?.brandIdentityInputs || {};

  const colorPreferences = isSkipped(brandInputs.colorPreferences) ? null : brandInputs.colorPreferences;
  const existingLogoFeedback = isSkipped(brandInputs.existingLogoFeedback) ? null : brandInputs.existingLogoFeedback;

  const colorSection = colorPreferences
    ? `COLOR PREFERENCES (from user):\n${colorPreferences}`
    : `COLOR PREFERENCES: Not provided. Derive color direction purely from the Brand Strategy and Visual Direction.`;

  const logoFeedbackSection = existingLogoFeedback
    ? `\nEXISTING LOGO FEEDBACK (from user):\n${existingLogoFeedback}`
    : '';

  const themeList = THEME_DEFINITIONS
    .map(t => `   - '${t.id}' — ${t.label}: ${t.description}`)
    .join('\n');

  return `You are a world-class brand strategist for US local contractors.

Your task is to create a comprehensive Brand Visual document (Markdown format) based on the provided Brand Strategy.

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND STRATEGY:
${brandStrategy}

EXTRACTED COLORS FROM LOGO (if any):
${extractedBrand ? JSON.stringify(extractedBrand, null, 2) : 'None'}

${colorSection}${logoFeedbackSection}

OUTPUT FORMAT:
Return a JSON object containing:
1. "markdown": A well-structured markdown document (\`brand-visual.md\`) that includes:
   - Visual Strategy & Personality
   - Logo Direction (type, concept, characteristics, avoid)
   - Color Direction (primary territory, secondary, accent, avoid)
   - Typography (primary, secondary, personality)
   - Photography direction
   - Iconography & Graphic Language
   - Brand Recognition (trucks, uniforms, yard signs, website, social)
   - Visual North Star

2. "recommendedTheme": The best matching theme ID from the following list (choose ONLY one ID exactly as written):
${themeList}

RULES:
1. If EXTRACTED COLORS FROM LOGO exist, you MUST preserve them in your Color Direction.
2. The visual style must align with the brand personality.
3. Recommend the theme that best matches the Visual Strategy.

Return ONLY the raw JSON object without any code blocks or wrapper JSON.`;
}
