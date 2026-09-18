export const CSSContract = {
  // Enforce design token usage
  mustReferenceDesignTokens: true,

  // Tailwind color prefixes allowed
  allowedColorPrefixes: [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'gray',
    'white',
    'black',
    'transparent',
    'current',
  ],

  // Forbidden Tailwind patterns
  forbiddenClasses: [
    /-\[\d+(px|rem|em|%)\]/,            // No arbitrary values e.g., w-[500px] or text-[14px]
    /bg-\[#.*\]/,                       // No arbitrary hex background colors
    /text-\[#.*\]/,                     // No arbitrary hex text colors
    /z-\[\d{3,}\]/,                     // No z-index > 99
    /fixed/,                            // No fixed positioning (breaks page flow)
    /!important/,                       // No !important overrides
  ],

  // Required responsive breakpoints to ensure the component is mobile-friendly
  requiredBreakpoints: ['md', 'lg'],

  // Size constraints (to prevent absurdly large text)
  maxFontSizeRem: 6,                    // Max 6rem (96px)
  minFontSizeRem: 0.75,                 // Min 0.75rem (12px)
};
