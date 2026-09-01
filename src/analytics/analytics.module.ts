import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { GoogleAuthClient } from './clients/google-auth.client';
import { Ga4Client } from './clients/ga4.client';
import { GtmClient } from './clients/gtm.client';
import { GscClient } from './clients/gsc.client';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [AnalyticsController],
  providers: [
    GoogleAuthClient,
    Ga4Client,
    GtmClient,
    GscClient,
    AnalyticsService
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
