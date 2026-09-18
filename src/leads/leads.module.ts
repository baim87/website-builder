import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PrivateLeadsController } from './private-leads.controller';
import { LeadsGateway } from './leads.gateway';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { WebhookIntegrationController } from './webhook-integration.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule, AssetsModule],
  controllers: [LeadsController, PrivateLeadsController, WebhookIntegrationController],
  providers: [LeadsService, LeadsGateway, WebhookDispatchService],
  exports: [LeadsService],
})
export class LeadsModule {}
