export const ComponentContract = {
  // Allowed imports (whitelist approach to prevent unauthorized libraries)
  allowedImports: [
    'react',
    'next/link',
    'next/image',
    'lucide-react',
    '../data/types',
    'embla-carousel-react',
  ],

  // Forbidden patterns in generated code (security and stability)
  forbiddenPatterns: [
    /dangerouslySetInnerHTML/,          // XSS risk
    /eval\(/,                           // Code injection
    /document\./,                       // No direct DOM manipulation (must use React)
    /window\./,                         // No window access
    /fetch\(/,                          // No network calls from components (should be passed as props)
    /localStorage|sessionStorage/,      // No storage access
    /process\.env/,                     // No env access in components
    /style={{.*}}/,                     // No inline styles (must use Tailwind classes)
  ],

  // Required patterns
  requiredPatterns: [
    /export\s+(default\s+)?function/,   // Must export a function component
    /className=/,                       // Must use Tailwind (className)
  ],
};
