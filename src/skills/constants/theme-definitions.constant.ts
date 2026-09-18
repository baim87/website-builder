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
  {
    id: 'awesomic',
    label: 'Awesomic (Technical Marketplace)',
    description: 'Restrained, zinc-gray scale with one vivid orange accent badge. Infrastructure-grade.',
    designSystemHints: 'Canvas background: #f4f4f5. Card surface: #ffffff. Primary CTA (filled): #09090b with white text. Secondary text: #18181b. Muted text: #52525b. Primary action buttons MUST be a deep near-black (#09090b). Use the provided primary or accent color EXCLUSIVELY for small badges or highlight chips, NEVER for buttons or general UI. The system is 99% achromatic.',
    componentStyleRules: 'Cards MUST have generous 36px border-radius (rounded-[36px]). Buttons and inputs use 14px radius (rounded-xl). Small badges use 12px radius. Navigation CTAs use 10000px pill radius (rounded-full). NEVER use drop shadows on cards; elevation is created EXCLUSIVELY using a hairline 1px solid #ececee border (border border-[#ececee]). Use 28px internal padding on cards. Major page sections should have 80px vertical gap. Hero uses a split composition with a massive left-aligned headline.',
    globalCssHints: 'Set --radius-default to 36px. Set --shadow-default to none. Add --radius-button: 14px. Set page max-width to 1200px. No shadows for cards.',
    typographyHints: {
      headingStyle: 'A single custom geometric sans (e.g. Cosmica, or fallback to DM Sans). Hero display headlines MUST be huge (56–64px) at weight 600 with tight 1.12–1.28 line-height.',
      bodyStyle: 'Compact, dense, marketplace-grade body text at 14–15px weight 400. Badges use 12px weight 400.',
    },
  },
  {
    id: 'mercury',
    label: 'Mercury (Alpine Banking)',
    description: 'Dark, cinematic, and monochromatic with a single vivid cobalt action color.',
    designSystemHints: 'Canvas background MUST be a near-black onyx (#171721). Card surfaces are slightly lighter graphite (#1e1e2a). Primary text is ivory (#ededf3) and muted text is ash (#c3c3cc). Use the provided primary or accent color EXCLUSIVELY for the single most important primary CTA button on the page. All other secondary actions must be transparent ghost buttons with a 1px ivory border. The design is strictly dark mode and overwhelmingly monochromatic. NEVER use shadows; separation comes from the value difference between the #171721 canvas and #1e1e2a cards.',
    componentStyleRules: 'Cards MUST have a 12px border-radius and sit completely flat on the canvas (NO drop shadows, NO borders on cards). Interactive controls (buttons, inputs, nav pills) MUST be heavily rounded (rounded-full or 32px pill shape). Maintain spacious density: use 32px padding inside cards and 72px vertical rhythm between major page sections. The hero section should be full-bleed with a photographic landscape background and a subtle dark overlay.',
    globalCssHints: 'Set --radius-default to 12px for cards. Set --shadow-default to none. Set --radius-button to 9999px. Use spacious layouts. Cards use bg-[#1e1e2a] and canvas is bg-[#171721].',
    typographyHints: {
      headingStyle: 'A confident, intermediate-weight display sans (e.g. Söhne Breit, or fallback to Inter/Helvetica). Use weight 480 (font-medium or font-normal, NEVER bold). Display text uses tight line-height (1.1) and slight positive letter-spacing.',
      bodyStyle: 'Clean, calibrated body sans at 16px weight 400 with a generous 1.5 line-height.',
    },
  },
  {
    id: 'hyer-aviation',
    label: 'Hyer Aviation (Luxury Travel Editorial)',
    description: 'Mixed light/dark editorial layout, extreme architectural typography, single warm accent.',
    designSystemHints: 'Use a pure white (#ffffff) canvas for most sections, and deep midnight/ink (#0f0f1c or #000d10) for full-bleed contrast sections (like Footer or Support). Primary text is near-black deep ink (#000d10) on white sections. Use the provided primary or accent color EXCLUSIVELY for one featured card or the primary filled CTA. Use ghost buttons with white borders on dark sections. The palette is austere and monochrome with a single warm focal point.',
    componentStyleRules: 'Cards should have hard edges (0px radius) and NO shadows. Contrast this by using extreme 1000px pill-shapes for ALL interactive elements (buttons, nav pills). Alternate between white sections and full-bleed dark sections to create vertical rhythm. Use right-aligned content blocks on single columns to create strong rightward gravity.',
    globalCssHints: 'Set --radius-default to 0px for cards, but set --radius-button to 9999px for CTAs. Set --shadow-default to none. Maintain very spacious density (80px section gaps).',
    typographyHints: {
      headingStyle: 'A massive, heavy display sans (e.g. Helvetica Now Display, or fallback to Inter/Helvetica). Use weight 700. Display text MUST use extreme tight tracking (negative letter-spacing) and a very tight line-height (0.8 - 1.0). End major hero headlines with a period.',
      bodyStyle: 'Clean, spacious body sans at 18px weight 400 with a very generous 1.61 line-height. Muted text should be cool ash (#8e8e95).',
    },
  },
  {
    id: 'superpower',
    label: 'Superpower (Cinematic Health Tech)',
    description: 'Crisp white surfaces, floating dark pill navigation, whisper-weight typography, and a single sunrise orange accent.',
    designSystemHints: 'Canvas is pure paper white (#ffffff). Dark elements are carbon black (#18181b). Use the provided primary or accent color EXCLUSIVELY for the primary filled CTA pill and subtle decorative touches, nowhere else. The hero MUST use full-bleed cinematic dark photography. Navigation MUST be a floating carbon black pill capsule over the hero image, not a full-width flat bar. Surfaces are mostly flat with only hairline mist gray (#e4e4e7) borders and almost zero shadows.',
    componentStyleRules: 'Cards use a compact 15px border-radius. ALL interactive elements (buttons, nav bar, CTAs) MUST use extreme 9999px pill radii. Rely on whitespace and hairline zinc dividers for separation. Use a compact density with 75px section gaps but tight internal element gaps (11px).',
    globalCssHints: 'Set --radius-default to 15px for cards, and --radius-button to 9999px. Use minimal shadows (--shadow-subtle only).',
    typographyHints: {
      headingStyle: 'A proprietary geometric sans (e.g. Inter Tight or Switzer). CRITICAL: Display headlines MUST be set at weight 400 (whisper-weight, NEVER bold) with extremely tight negative tracking (-0.025em) and tight 1.0 line-height. This creates a monolithic, poster-like density.',
      bodyStyle: 'Clean, dense body sans at 15-17px with 1.4-1.5 line-height. Use a monospace font (like JetBrains Mono) sparingly for tiny tabular metadata or micro-copy annotations.',
    },
  },
  {
    id: '11x-editorial',
    label: '11x (Cinematic Editorial Serif)',
    description: 'Cinematic desert-toned photography, oversized didone serif typography, and minimal pastel punctuation.',
    designSystemHints: 'The system uses an editorial magazine model. Canvas is paper white (#ffffff). Dark narrative bands use Deep Teal (#0b252a). Text is Obsidian black (#000000). Use very pale, muted pastel versions of the provided brand colors EXCLUSIVELY as background tints for feature cards, never for buttons. Buttons are always black or white pills. Never use gradients or drop shadows. Hero photography MUST be cinematic full-bleed terrain/desert imagery.',
    componentStyleRules: 'Cards use a 16px border-radius, except for portrait cards which use 32px. Buttons MUST be extreme 999px pills. Elevation is achieved SOLELY through tonal contrast and 1px hairline bone/iron borders — absolutely NO shadows. Alternate between white editorial sections and full-bleed deep teal bands. Use a generous 80px vertical rhythm between sections.',
    globalCssHints: 'Set --radius-default to 16px. Set --radius-button to 999px. Use NO shadows (--shadow-default to none).',
    typographyHints: {
      headingStyle: 'CRITICAL: ALL UI text must use a high-contrast didone-influenced serif (e.g. GT Sectra, Bodoni Moda, Playfair Display). Display headlines MUST be massive (74-152px) with very tight negative letter-spacing (-0.045em) and tight 0.85-1.0 line-height.',
      bodyStyle: 'Use the SAME serif font for body text, set at 16-19px with -0.02em letter-spacing. Do NOT use a sans-serif anywhere in the system.',
    },
  },
];

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_DEFINITIONS.find(t => t.id === id);
}
