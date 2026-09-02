"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentContract = void 0;
exports.ComponentContract = {
    allowedImports: [
        'react',
        'next/link',
        'next/image',
        'lucide-react',
        '../data/types',
        'embla-carousel-react',
    ],
    forbiddenPatterns: [
        /dangerouslySetInnerHTML/,
        /eval\(/,
        /document\./,
        /window\./,
        /fetch\(/,
        /localStorage|sessionStorage/,
        /process\.env/,
        /style={{.*}}/,
    ],
    requiredPatterns: [
        /export\s+(default\s+)?function/,
        /className=/,
    ],
};
//# sourceMappingURL=component-contract.js.map