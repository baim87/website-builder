import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BillingBypassMiddleware } from './billing-bypass.middleware';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

import { SubscriptionQCEnforcer } from './subscription-qc.enforcer';
import { QueueModule } from '../queue/queue.module';
import { forwardRef } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule, forwardRef(() => QueueModule)],
  controllers: [BillingController],
  providers: [BillingService, SubscriptionQCEnforcer],
  exports: [BillingService],
})
export class BillingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(BillingBypassMiddleware).forRoutes('*');
  }
}
