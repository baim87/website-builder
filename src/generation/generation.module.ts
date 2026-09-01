import { Module, forwardRef } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { NextjsBuilderService } from './nextjs-builder.service';
import { SiteContentService } from './site-content.service';
import { PublicSiteController } from './public-site.controller';
import { SkillsModule } from '../skills/skills.module';
import { ProjectsModule } from '../projects/projects.module';
import { SeoModule } from '../seo/seo.module';

@Module({
  imports: [SkillsModule, forwardRef(() => ProjectsModule), SeoModule],
  controllers: [PublicSiteController],
  providers: [GenerationService, NextjsBuilderService, SiteContentService],
  exports: [GenerationService, NextjsBuilderService, SiteContentService],
})
export class GenerationModule {}
