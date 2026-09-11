import { Module, forwardRef } from '@nestjs/common';
import { CostAggregatorService } from './cost-aggregator.service';
import { SkillLoggerService } from './skill-logger.service';
import { SkillExecutorService } from './skill-executor.service';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { BrandKitGeneratorSkill } from './impl/brand-kit-generator.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SectionContentSkill } from './impl/section-content.skill';
import { KeywordStrategySkill } from './impl/keyword-strategy.skill';
import { CSSStyleSkill } from './impl/css-style.skill';
import { CopyWriterSkill } from './impl/copy-writer.skill';
import { UIDesignerSkill } from './impl/ui-designer.skill';
import { ComponentGeneratorSkill } from './impl/component-generator.skill';
import { CodeRepairSkill } from './impl/code-repair.skill';
import { ComponentValidationSkill } from './impl/component-validation.skill';
import { ImagePlannerSkill } from './impl/image-planner.skill';
import { AssetRepairSkill } from './impl/asset-repair.skill';
import { CopywritingRepairSkill } from './impl/copywriting-repair.skill';
import { ComponentEditorSkill } from './impl/component-editor.skill';
import { GenerationOrchestratorService } from '../generation/generation-orchestrator.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { UnsplashService } from '../assets/unsplash.service';
import { QueueModule } from '../queue/queue.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AIGatewayModule, PrismaModule, GuardrailsModule, KeywordsModule, forwardRef(() => QueueModule), forwardRef(() => AssetsModule)],
  providers: [
    SkillLoggerService,
    SkillExecutorService,
    BrandIdentitySkill,
    BrandVoiceSkill,
    DesignSystemSkill,
    SeoMetadataSkill,
    PageStructureSkill,
    ImagePlannerSkill,
    SectionContentSkill,
    KeywordStrategySkill,
    CSSStyleSkill,
    CopyWriterSkill,
    UIDesignerSkill,
    ComponentGeneratorSkill,
    CodeRepairSkill,
    ComponentValidationSkill,
    AssetRepairSkill,
    CopywritingRepairSkill,
    ComponentEditorSkill,
    GenerationOrchestratorService,
    UnsplashService,
    CostAggregatorService,
    BrandKitGeneratorSkill,
  ],
  exports: [SkillExecutorService, GenerationOrchestratorService, CodeRepairSkill, ComponentValidationSkill, AssetRepairSkill, CopywritingRepairSkill, CostAggregatorService, BrandKitGeneratorSkill, ComponentEditorSkill],
})
export class SkillsModule {}
