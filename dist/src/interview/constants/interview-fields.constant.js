"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_FIELDS = exports.BRAND_FIELDS = exports.BUSINESS_FIELDS = void 0;
exports.BUSINESS_FIELDS = [
    'businessName',
    'contactPerson',
    'businessAddress',
    'phone',
    'email',
    'trade',
    'services',
    'serviceAreas',
    'hours',
];
exports.BRAND_FIELDS = [
    'brandVoicePreference',
    'primaryColor',
    'secondaryColor',
    'fontStyle',
];
exports.REQUIRED_FIELDS = [...exports.BUSINESS_FIELDS, ...exports.BRAND_FIELDS];
//# sourceMappingURL=interview-fields.constant.js.map