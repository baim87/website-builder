import { Module } from '@nestjs/common';
import { SkillLoggerService } from './skill-logger.service';
import { SkillExecutorService } from './skill-executor.service';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SectionContentSkill } from './impl/section-content.skill';
import { KeywordStrategySkill } from './impl/keyword-strategy.skill';
import { CSSStyleSkill } from './impl/css-style.skill';
import { CopyWriterSkill } from './impl/copy-writer.skill';
import { UIDesignerSkill } from './impl/ui-designer.skill';
import { OrchestratorService } from './orchestrator.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { UnsplashService } from '../images/unsplash.service';

@Module({
  imports: [AIGatewayModule, PrismaModule, GuardrailsModule, KeywordsModule],
  providers: [
    SkillLoggerService,
    SkillExecutorService,
    BrandIdentitySkill,
    BrandVoiceSkill,
    DesignSystemSkill,
    SeoMetadataSkill,
    PageStructureSkill,
    SectionContentSkill,
    KeywordStrategySkill,
    CSSStyleSkill,
    CopyWriterSkill,
    UIDesignerSkill,
    OrchestratorService,
    UnsplashService,
  ],
  exports: [SkillExecutorService, OrchestratorService],
})
export class SkillsModule {}
