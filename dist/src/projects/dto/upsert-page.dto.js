"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertPageSchema = void 0;
const zod_1 = require("zod");
exports.UpsertPageSchema = zod_1.z.object({
    content: zod_1.z.array(zod_1.z.any()),
    componentCode: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    seoMeta: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    keywordTarget: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
//# sourceMappingURL=upsert-page.dto.js.map