import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
export declare const tenantContext: AsyncLocalStorage<{
    userId: string;
}>;
export declare function tenantMiddleware(): Prisma.Middleware;
