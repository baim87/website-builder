import { SkillExecutorService } from './skill-executor.service';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';
import { KeywordStrategySkill } from './impl/keyword-strategy.skill';
import { CSSStyleSkill } from './impl/css-style.skill';
import { CopyWriterSkill } from './impl/copy-writer.skill';
import { UIDesignerSkill } from './impl/ui-designer.skill';
import { PrismaService } from '../prisma/prisma.service';
import { UnsplashService } from '../images/unsplash.service';
export declare class OrchestratorService {
    private readonly executor;
    private readonly brandVoice;
    private readonly brandIdentity;
    private readonly designSystem;
    private readonly pageStructure;
    private readonly seoMetadata;
    private readonly keywordStrategy;
    private readonly cssStyle;
    private readonly copyWriter;
    private readonly uiDesigner;
    private readonly prisma;
    private readonly unsplash;
    private readonly logger;
    constructor(executor: SkillExecutorService, brandVoice: BrandVoiceSkill, brandIdentity: BrandIdentitySkill, designSystem: DesignSystemSkill, pageStructure: PageStructureSkill, seoMetadata: SeoMetadataSkill, keywordStrategy: KeywordStrategySkill, cssStyle: CSSStyleSkill, copyWriter: CopyWriterSkill, uiDesigner: UIDesignerSkill, prisma: PrismaService, unsplash: UnsplashService);
    private executeWithRetries;
    generateWebsite(projectId: string, businessContext: any, onPageGenerated?: (page: any) => Promise<void>): Promise<{
        designTokens: any;
        globalCss: any;
        brandVoice: any;
        keywordStrategy: any;
        pages: any[];
    }>;
    private getFallbackSection;
    private resolveImages;
}
