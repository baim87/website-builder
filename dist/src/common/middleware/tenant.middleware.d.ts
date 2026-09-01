import { NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { RequestWithUser } from '../interfaces/request-with-user.interface';
export declare class TenantMiddleware implements NestMiddleware {
    use(req: RequestWithUser, _res: Response, next: NextFunction): void;
}
