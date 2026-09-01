import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BillingBypassMiddleware } from './billing-bypass.middleware';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(BillingBypassMiddleware).forRoutes('*');
  }
}
