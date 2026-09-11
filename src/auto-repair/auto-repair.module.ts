import { Module } from '@nestjs/common';
import { ComponentRepairService } from './component-repair.service';
import { CopywritingRepairService } from './copywriting-repair.service';
import { BrandRepairService } from './brand-repair.service';
import { AssetRepairService } from './asset-repair.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillsModule } from '../skills/skills.module';
import { AssetsModule } from '../assets/assets.module';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [
    PrismaModule,
    SkillsModule,
    AssetsModule,
    AIGatewayModule,
  ],
  providers: [
    ComponentRepairService,
    CopywritingRepairService,
    BrandRepairService,
    AssetRepairService,
  ],
  exports: [
    ComponentRepairService,
    CopywritingRepairService,
    BrandRepairService,
    AssetRepairService,
  ],
})
export class AutoRepairModule {}
