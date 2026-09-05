export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  designSystemHints: string;
  componentStyleRules: string;
  globalCssHints: string;
  typographyHints: {
    headingStyle: string;
    bodyStyle: string;
  };
}

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'editorial-luxury',
    label: 'Editorial Luxury',
    description: 'Sophisticated magazine-style layouts with warm earth tones',
    designSystemHints: 'Use a warm, organic cream/beige/taupe for the main background (e.g., #F4F1EB). Primary text should be a deep charcoal or espresso, never pure black. Dark surfaces should be a rich, warm dark charcoal. Spacing should be extremely generous with massive amounts of negative space.',
    componentStyleRules: 'Emulate a high-end architectural digest magazine spread. Avoid strict, boxy SaaS grids. Use asymmetric layouts and overlapping images. Use extremely thin, delicate divider lines (e.g., border-t border-[color]). Use minimal border radius (rounded-none or rounded-sm). Do NOT use heavy box shadows.',
    globalCssHints: 'Set --radius-default to 0px (sharp corners). Set --shadow-default to none. Add letter-spacing: 0.05em to headings for an editorial feel. Set generous section padding (py-24 or py-32 equivalent). Do NOT add default box-shadows or border-radius to cards.',
    typographyHints: {
      headingStyle: 'High-contrast, elegant serif font (e.g., Playfair Display, Lora, or custom architectural serifs). Use italics for elegant emphasis.',
      bodyStyle: 'Clean, understated, and readable sans-serif with generous line height.',
    },
  },
  {
    id: 'modern-minimalist',
    label: 'Modern Minimalist',
    description: 'Crisp white backgrounds with stark contrast and clean grids',
    designSystemHints: 'Use stark white (#FFFFFF) for the main background to create an ultra-clean, clinical feel. Use very deep slate or dark charcoal for dark surfaces. Maintain extremely high contrast between light and dark sections. Use a modern, punchy accent color (like terracotta or bold blue) exclusively for CTAs.',
    componentStyleRules: 'Design with strict, highly organized grids. The layout should feel crisp and precise. Use very thin 1px borders (border border-gray-200) for cards, grid items, and horizontal dividers. Use sharp corners (rounded-none) for most structural elements, but images and CTA blocks can use slight rounding (rounded-xl) to soften the look. Avoid heavy box shadows.',
    globalCssHints: 'Set --radius-default to 0px for structural elements. Add a --radius-image variable at 12px for images only. Set --shadow-default to none. Use tight, precise spacing. Add a subtle 1px border utility class for card outlines.',
    typographyHints: {
      headingStyle: 'Modern, precise serif font or a very sharp sans-serif. Highly structured and punchy.',
      bodyStyle: 'Very clean, minimalist sans-serif (e.g., Inter).',
    },
  },
  {
    id: 'soft-organic',
    label: 'Soft & Organic',
    description: 'Warm, approachable designs with rounded corners and natural tones',
    designSystemHints: 'Use a nature-inspired, earthy palette. Main backgrounds MUST be a warm, soft cream/beige; NEVER use stark white. The primary color should be an earthy tone (e.g., forest/olive green, warm terracotta). Dark sections should be deep forest greens or warm earthy browns. The vibe is warm, inviting, and botanical.',
    componentStyleRules: 'Use card-based layouts resting on the warm background. NEVER use sharp corners or harsh grid lines. Every element must be heavily rounded (rounded-2xl or rounded-3xl). Use pill-shaped containers (rounded-full) for navigation bars, badges, and buttons. Use soft, diffuse drop shadows (shadow-md or shadow-lg) on cards to lift them gently off the background.',
    globalCssHints: 'Set --radius-default to 16px (heavily rounded). Set --radius-pill to 9999px for buttons and badges. Set --shadow-default to 0 4px 24px rgba(0,0,0,0.08) (soft, diffuse). Ensure all interactive elements have smooth transitions (transition-all duration-300). Add a warm background-color to the body.',
    typographyHints: {
      headingStyle: 'Soft, rounded geometric sans-serif or a very gentle, low-contrast serif. Approachable and warm.',
      bodyStyle: 'Clean, friendly, and highly readable sans-serif.',
    },
  },
  {
    id: 'dark-bento',
    label: 'Dark Bento',
    description: 'Ultra-modern, dark industrial bento-box layouts with technical typography',
    designSystemHints: 'Use a strict dark mode aesthetic. The main background MUST be a very deep, rich charcoal or almost black (e.g., #0A0A0A). Primary text should be stark white or very light silver. Accent colors should be vibrant neon hues (like electric purple, cyan, or neon red) used very sparingly for glowing effects or thin borders.',
    componentStyleRules: 'Design using a strict "Bento Box" grid layout. Use very tight spacing between grid items (gap-4 or gap-6). Cards MUST have highly rounded corners (rounded-3xl) but NO drop shadows. Instead of shadows, wrap cards in a very thin, subtle 1px border (border border-white/10) over a slightly lighter dark background (bg-surface-dark). Buttons should be pill-shaped (rounded-full) and outlined rather than solid.',
    globalCssHints: 'Set --radius-default to 24px (heavily rounded bento boxes). Set --shadow-default to none. Add letter-spacing: 0.1em to headings for an industrial/futuristic feel. Use dark backgrounds everywhere. Ensure grid containers have strict, tight gaps.',
    typographyHints: {
      headingStyle: 'A wide, extended, industrial or futuristic sans-serif font (e.g., Space Grotesk, Syncopate). High-impact and technical.',
      bodyStyle: 'Clean, technical, and precise sans-serif.',
    },
  },
];

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_DEFINITIONS.find(t => t.id === id);
}
