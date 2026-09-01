"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContext = void 0;
exports.tenantMiddleware = tenantMiddleware;
const async_hooks_1 = require("async_hooks");
exports.tenantContext = new async_hooks_1.AsyncLocalStorage();
const TENANT_SCOPED_MODELS = [
    'Project',
    'BusinessContext',
    'WebsiteData',
    'SiteAnalytics',
    'Asset',
    'ChatMessage',
    'SkillInvocation',
    'Domain',
    'Page',
];
function tenantMiddleware() {
    return async (params, next) => {
        const store = exports.tenantContext.getStore();
        if (!store?.userId) {
            return next(params);
        }
        const { model, action } = params;
        const isTenantScoped = model && TENANT_SCOPED_MODELS.includes(model);
        const isUserDirectModel = model === 'Subscription' || model === 'Payment';
        if (!isTenantScoped && !isUserDirectModel) {
            return next(params);
        }
        const safeWhereOperations = ['findMany', 'findFirst', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'];
        if (safeWhereOperations.includes(action)) {
            if (!params.args)
                params.args = {};
            if (!params.args.where)
                params.args.where = {};
            if (isTenantScoped) {
                if (model === 'Project') {
                    params.args.where.userId = store.userId;
                }
                else {
                    params.args.where.project = {
                        ...(params.args.where.project || {}),
                        userId: store.userId,
                    };
                }
            }
            else if (isUserDirectModel) {
                params.args.where.userId = store.userId;
            }
        }
        return next(params);
    };
}
//# sourceMappingURL=prisma-tenant.middleware.js.map