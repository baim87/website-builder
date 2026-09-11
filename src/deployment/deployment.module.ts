import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';

@Module({
  imports: [
    PrismaModule, 
    AIGatewayModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.IMAGE_GENERATION }),
    BullModule.registerQueue({ name: QUEUE_NAMES.GITHUB_SYNC }),
    BullModule.registerQueue({ name: QUEUE_NAMES.DEPLOYMENT_TRACKER })
  ],
  controllers: [DeploymentController],
  providers: [DeploymentService, GithubService],
  exports: [DeploymentService, GithubService],
})
export class DeploymentModule {}
