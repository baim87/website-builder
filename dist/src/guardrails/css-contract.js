"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSContract = void 0;
exports.CSSContract = {
    mustReferenceDesignTokens: true,
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
    forbiddenClasses: [
        /-\[\d+(px|rem|em|%)\]/,
        /bg-\[#.*\]/,
        /text-\[#.*\]/,
        /z-\[\d{3,}\]/,
        /fixed/,
        /!important/,
    ],
    requiredBreakpoints: ['md', 'lg'],
    maxFontSizeRem: 6,
    minFontSizeRem: 0.75,
};
//# sourceMappingURL=css-contract.js.map