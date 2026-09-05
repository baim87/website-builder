import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';
import { ComponentRepairService } from './component-repair.service';
import { SkillsModule } from '../skills/skills.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [SkillsModule, PrismaModule],
  controllers: [DeploymentController],
  providers: [DeploymentService, GithubService, ComponentRepairService],
  exports: [DeploymentService, GithubService, ComponentRepairService],
})
export class DeploymentModule {}
