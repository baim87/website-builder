import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';
import { ComponentRepairService } from './component-repair.service';
import { CopywritingRepairService } from './copywriting-repair.service';
import { BrandRepairService } from './brand-repair.service';
import { SkillsModule } from '../skills/skills.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsModule } from '../assets/assets.module';

import { AssetRepairService } from './asset-repair.service';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';

@Module({
  imports: [
    SkillsModule, 
    PrismaModule, 
    AssetsModule,
    AIGatewayModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.IMAGE_GENERATION }),
    BullModule.registerQueue({ name: QUEUE_NAMES.GITHUB_SYNC }),
    BullModule.registerQueue({ name: QUEUE_NAMES.DEPLOYMENT_TRACKER })
  ],
  controllers: [DeploymentController],
  providers: [DeploymentService, GithubService, ComponentRepairService, AssetRepairService, CopywritingRepairService, BrandRepairService],
  exports: [DeploymentService, GithubService, ComponentRepairService, AssetRepairService, CopywritingRepairService, BrandRepairService],
})
export class DeploymentModule {}
