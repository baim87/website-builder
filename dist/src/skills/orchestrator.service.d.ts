import { SkillExecutorService } from './skill-executor.service';
import { BrandVoiceSkill } from './impl/brand-voice.skill';
import { BrandIdentitySkill } from './impl/brand-identity.skill';
import { DesignSystemSkill } from './impl/design-system.skill';
import { PageStructureSkill } from './impl/page-structure.skill';
import { SectionContentSkill } from './impl/section-content.skill';
import { SeoMetadataSkill } from './impl/seo-metadata.skill';
export declare class OrchestratorService {
    private readonly executor;
    private readonly brandVoice;
    private readonly brandIdentity;
    private readonly designSystem;
    private readonly pageStructure;
    private readonly sectionContent;
    private readonly seoMetadata;
    private readonly logger;
    constructor(executor: SkillExecutorService, brandVoice: BrandVoiceSkill, brandIdentity: BrandIdentitySkill, designSystem: DesignSystemSkill, pageStructure: PageStructureSkill, sectionContent: SectionContentSkill, seoMetadata: SeoMetadataSkill);
    private executeWithRetries;
    generateWebsite(projectId: string, businessContext: any, onPageGenerated?: (page: any) => Promise<void>): Promise<{
        designTokens: any;
        brandVoice: any;
        pages: any[];
        seoMetadata: any;
    }>;
    private getFallbackSection;
}
