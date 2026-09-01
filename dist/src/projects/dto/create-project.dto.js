"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProjectSchema = void 0;
const zod_1 = require("zod");
exports.CreateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Project name is required').max(100),
    trade: zod_1.z.string().optional(),
});
//# sourceMappingURL=create-project.dto.js.map