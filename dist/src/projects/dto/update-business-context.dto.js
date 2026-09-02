"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBusinessContextSchema = void 0;
const zod_1 = require("zod");
exports.UpdateBusinessContextSchema = zod_1.z.object({
    businessName: zod_1.z.string().optional(),
    contactPerson: zod_1.z.string().optional(),
    businessAddress: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    hours: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    gbpData: zod_1.z.any().optional(),
    trade: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    radius: zod_1.z.any().optional(),
    services: zod_1.z.array(zod_1.z.string()).optional(),
    serviceAreas: zod_1.z.array(zod_1.z.string()).optional(),
    brandIdentityInputs: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    brandVoicePreference: zod_1.z.string().optional(),
    primaryColor: zod_1.z.string().optional(),
    secondaryColor: zod_1.z.string().optional(),
    fontStyle: zod_1.z.string().optional(),
    usps: zod_1.z.array(zod_1.z.string()).optional(),
    interviewMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
//# sourceMappingURL=update-business-context.dto.js.map