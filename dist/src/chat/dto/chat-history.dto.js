"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistorySchema = void 0;
const zod_1 = require("zod");
exports.ChatHistorySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(50),
});
//# sourceMappingURL=chat-history.dto.js.map