import { Module } from '@nestjs/common';
import { EditorController } from './editor.controller';
import { BlockEditorService } from './block-editor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { DeploymentModule } from '../deployment/deployment.module';

@Module({
  imports: [PrismaModule, SkillsModule, AuthModule, DeploymentModule],
  controllers: [EditorController],
  providers: [BlockEditorService],
})
export class EditorModule {}
