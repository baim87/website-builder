import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<{ userId: string }>();

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

export function tenantMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const store = tenantContext.getStore();
    if (!store?.userId) {
      return next(params);
    }

    const { model, action } = params;
    const isTenantScoped = model && TENANT_SCOPED_MODELS.includes(model);
    const isUserDirectModel = model === 'Subscription' || model === 'Payment';

    if (!isTenantScoped && !isUserDirectModel) {
      return next(params);
    }

    // Operations that support where clauses and accept non-unique fields
    const safeWhereOperations = ['findMany', 'findFirst', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'];

    if (safeWhereOperations.includes(action)) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};

      if (isTenantScoped) {
        if (model === 'Project') {
          params.args.where.userId = store.userId;
        } else {
          params.args.where.project = {
            ...(params.args.where.project || {}),
            userId: store.userId,
          };
        }
      } else if (isUserDirectModel) {
        params.args.where.userId = store.userId;
      }
    }

    // For create/findUnique/update/delete, we pass through.
    // In a real RLS setup, these would be blocked at the DB level, but Prisma middleware cannot
    // easily safely intercept these without crashing or causing N+1 queries.

    return next(params);
  };
}
