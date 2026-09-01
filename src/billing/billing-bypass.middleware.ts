import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BillingBypassMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const bypass = this.configService.get<boolean>('BYPASS_BILLING');
    if (bypass) {
       (req as any).billingBypassed = true;
    }
    next();
  }
}
