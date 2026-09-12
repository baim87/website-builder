import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext } from '../../prisma/prisma-tenant.middleware';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (userId) {
      return new Observable((subscriber) => {
        tenantContext.run({ userId }, () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    return next.handle();
  }
}
