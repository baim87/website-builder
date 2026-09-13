import { Module, forwardRef } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { NextjsBuilderService } from './nextjs-builder.service';
import { SiteContentService } from './site-content.service';
import { PublicSiteController } from './public-site.controller';
import { SkillsModule } from '../skills/skills.module';
import { ProjectsModule } from '../projects/projects.module';
import { SeoModule } from '../seo/seo.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { QueueModule } from '../queue/queue.module';
import { AssetsModule } from '../assets/assets.module';
import { GenerationGateway } from './generation.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SkillsModule, forwardRef(() => ProjectsModule), SeoModule, DeploymentModule, forwardRef(() => QueueModule), AssetsModule, AuthModule],
  controllers: [PublicSiteController],
  providers: [GenerationService, NextjsBuilderService, SiteContentService, GenerationGateway],
  exports: [GenerationService, NextjsBuilderService, SiteContentService],
})
export class GenerationModule {}
