import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypassBilling = this.configService.get<boolean>('BYPASS_BILLING');
    if (bypassBilling) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
      throw new ForbiddenException('Active billing subscription required');
    }

    if (new Date() > new Date(subscription.currentPeriodEnd)) {
      throw new ForbiddenException('Billing subscription has expired');
    }

    return true;
  }
}
