"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordQuerySchema = void 0;
const zod_1 = require("zod");
exports.KeywordQuerySchema = zod_1.z.object({
    trade: zod_1.z.string().min(1),
    location: zod_1.z.string().min(1),
});
//# sourceMappingURL=keyword-query.dto.js.map