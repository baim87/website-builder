import { getThemeById } from '../../constants/theme-definitions.constant';

export function buildCssStylePrompt(
  designSystem: any,
  themePreference?: string,
): string {
  const theme = themePreference ? getThemeById(themePreference) : undefined;
  let themeHints = '';
  if (theme && theme.globalCssHints) {
    themeHints = `\nTHEME CSS RULES (${theme.label}):\n${theme.globalCssHints}\nYou MUST incorporate these rules into the generated CSS.\n`;
  }

  return `You are a Tailwind CSS configuration expert.
Given this design system, generate the CSS overrides for a modern Tailwind CSS v4 project.

DESIGN SYSTEM:
Colors: ${JSON.stringify(designSystem.colors, null, 2)}
Typography: ${JSON.stringify(designSystem.typography, null, 2)}
${themeHints}
REQUIREMENTS:
1. Output valid CSS that defines CSS variables on the :root pseudo-class.
2. Define the @theme block to map these variables to Tailwind's color system (e.g., --color-primary: var(--color-primary);).
3. DO NOT include arbitrary pixel sizes for typography, use Tailwind's text scales.
4. The output must strictly follow this structure:

\`\`\`css
@import "tailwindcss";

:root {
  /* Define variables */
}

@theme {
  /* Override default theme */
}

@config {
  /* Disable arbitrary values by restricting the core plugins if necessary */
}
\`\`\`

Return ONLY the raw CSS code. No explanations.`;
}
