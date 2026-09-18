import { getThemeById } from '../../constants/theme-definitions.constant';

export function buildDesignSystemPrompt(
  businessContext: any,
  brandVisual: string,
  themePreference?: string,
): string {
  const theme = themePreference ? getThemeById(themePreference) : undefined;
  
  let themeHints = '';
  if (theme && theme.designSystemHints && !theme.designSystemHints.includes('TODO')) {
    themeHints = `\nTHEME AESTHETIC (${theme.label}):\n${theme.designSystemHints}\n`;
  }

  return `Analyze this contractor business and generate a complete design system (colors, typography, spacing) using the provided tool.
Business Context: ${JSON.stringify(businessContext)}
Brand Identity Constraints: ${brandVisual || 'Not provided'}${themeHints}

AESTHETICS RULE: The color palette MUST align perfectly with the brand's logo and identity. You may use dark colors if the logo/brand dictates it. You MUST ensure strict contrast (e.g., light text on dark backgrounds, or dark text on light backgrounds) for readability. Avoid generic SaaS defaults; focus on a professional, trustworthy contractor aesthetic. CRITICAL: If there is a conflict between the THEME AESTHETIC and the Brand Identity Constraints (e.g. the theme suggests a green primary color, but the brand identity dictates blue), the Brand Identity Constraints ALWAYS win for the primary and secondary colors. The Theme Aesthetic should strictly govern the backgrounds, dark surfaces, and overall vibe.

FIELD GUIDANCE (for the tool output):
- colors.primary: The brand's main action/CTA color. Used for buttons, links, highlights. Must be a hex value.
- colors.secondary: The brand's secondary color. May be light or dark based on user input. Hex value.
- colors.accent: A supporting color for badges, borders, or subtle highlights. Hex value.
- colors.background: The main page background. Usually light (white or near-white). Hex value.
- colors.text: The default body text color. Must have strong contrast against the background. Hex value.
- colors.surfaceDark: A generated DARK contrasting color used for overlays and dark sections (footers, hero overlays). MUST be dark enough (luminance < 0.3) so white text is readable on top. You MUST invent this complementary dark color if the user provides a light secondary color. Hex value.
- colors.headerBg: Background color for the Header. Pass through from Brand Identity if available. Hex value.
- colors.footerBg: Background color for the Footer. Pass through from Brand Identity if available. Hex value.
- typography.headingFont: A Google Fonts heading font family name.
- typography.bodyFont: A Google Fonts body font family name.
- spacing.small: e.g. "8px"
- spacing.medium: e.g. "16px"
- spacing.large: e.g. "32px"

Output the design system via the provided tool.`;
}
