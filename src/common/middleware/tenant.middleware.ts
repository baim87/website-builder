import { Injectable, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
import { tenantContext } from '../../prisma/prisma-tenant.middleware';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: RequestWithUser, _res: Response, next: NextFunction) {
    const userId = req.user?.id;
    if (userId) {
      tenantContext.run({ userId }, () => {
        next();
      });
    } else {
      next();
    }
  }
}
