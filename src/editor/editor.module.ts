import { Module } from '@nestjs/common';
import { EditorController } from './editor.controller';
import { BlockEditorService } from './block-editor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, SkillsModule, AuthModule, DeploymentModule, QueueModule],
  controllers: [EditorController],
  providers: [BlockEditorService],
  exports: [BlockEditorService],
})
export class EditorModule {}
