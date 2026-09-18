import { z } from 'zod';

/**
 * @deprecated Replaced by BrandKnowledgeService and brand-voice.md
 */
export const BrandVoiceSchema = z.object({
  tone: z.string(),
  vocabulary: z.array(z.string()),
  rules: z.array(z.string()),
});

/**
 * @deprecated Replaced by BrandStrategySynthesisSkill and brand knowledge files
 */
export const BrandKitSchema = z.object({
  brandName: z.string().describe('Short, premium, original brand name'),
  slogan: z.string().describe('Short slogan focused on the trade'),
  positioning: z.string().describe('Explain what this product/service is and how it should be positioned in the market'),
  targetAudience: z.string().describe('Define the ideal audience'),
  personality: z.string().describe('Describe the brand personality'),
  colors: z.object({
    primary: z.string().describe('Primary color in HEX format'),
    secondary: z.string().describe('Secondary color in HEX format'),
    accent: z.string().describe('Accent color in HEX format'),
  }),
  typography: z.object({
    headingFont: z.string().describe('Suggested Google Font for headings'),
    bodyFont: z.string().describe('Suggested Google Font for body text'),
  }),
  logoDirection: z.string().describe('Describe a simple logo concept'),
  serviceDescription: z.string().describe('Detailed service overview'),
  keyBenefits: z.array(z.string()).describe('List of main benefits/features'),
  visualMood: z.string().describe('Describe the visual direction for the website: lighting, atmosphere, etc.'),
  websiteGoal: z.string().describe('Define the goal of the landing page'),
  suggestedSections: z.array(z.string()).describe('Suggest a clear section structure for the landing page'),
});

export const BrandVisualOutputSchema = z.object({
  markdown: z.string().describe('Full markdown for brand-visual.md'),
  recommendedTheme: z.enum([
    'editorial-luxury', 'modern-minimalist', 'soft-organic', 'dark-bento',
    'awesomic', 'mercury', 'hyer-aviation', 'superpower', '11x-editorial'
  ]).describe('Best matching theme ID from THEME_DEFINITIONS'),
});

export const BrandKnowledgeSchema = z.object({
  strategy: z.string().describe('Full markdown for brand-strategy.md'),
  positioning: z.string().describe('Full markdown for brand-positioning.md'),
  voice: z.string().describe('Full markdown for brand-voice.md'),
  visual: z.string().describe('Full markdown for brand-visual.md'),
  messaging: z.string().describe('Full markdown for brand-messaging.md'),
  story: z.string().describe('Full markdown for brand-story.md'),
  recommendedTheme: z.enum([
    'editorial-luxury', 'modern-minimalist', 'soft-organic', 'dark-bento',
    'awesomic', 'mercury', 'hyer-aviation', 'superpower', '11x-editorial'
  ]).describe('Best matching theme ID from THEME_DEFINITIONS'),
});

export const DesignSystemSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
    surfaceDark: z.string(),
    headerBg: z.string().optional(),
    footerBg: z.string().optional(),
  }),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
  }),
  spacing: z.record(z.string(), z.string()),
});

export const SeoMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  ogImagePlaceholder: z.string(),
});

export const KeywordStrategySchema = z.object({
  pages: z.array(z.object({
    slug: z.string(),
    primaryKeyword: z.object({
      keyword: z.string(),
      volume: z.number(),
    }),
    secondaryKeywords: z.array(z.object({
      keyword: z.string(),
      volume: z.number(),
    })),
    searchIntent: z.enum(['commercial', 'informational', 'local']),
  }))
});

export const PageSeoSchema = z.object({
  slug: z.string(),
  title: z.string().describe('SEO Title. Try to keep around 60 chars.'),
  description: z.string().describe('Meta description. Try to keep around 160 chars.'),
  h1: z.string(),
  keywords: z.array(z.string()),
  ogTitle: z.string(),
  ogDescription: z.string(),
  canonicalPath: z.string(),
  image: z.string().optional().describe('URL to the primary image for the page (og:image / JSON-LD)'),
});

const PrimitiveTypeSchema = z.string();

export const CopyDataSchema = z.record(z.string(), z.any());

export const ASTNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string().optional(),
  type: PrimitiveTypeSchema,
  props: z.record(z.string(), z.any()).optional(),
  children: z.array(z.union([ASTNodeSchema, z.string()])).optional(),
}));

export const SectionSchema = z.object({
  id: z.string(),
  type: z.string(),
  ast: ASTNodeSchema
});

export const PageStructureSchema = z.object({
  sections: z.array(z.string())
});

export const PageContentSchema = z.object({
  slug: z.string(),
  sections: z.array(SectionSchema)
});

// TypeScript Types (Single Source of Truth)
export type DesignSystem = z.infer<typeof DesignSystemSchema> & { globalCss?: string };
export type ASTNode = z.infer<typeof ASTNodeSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type PageContent = z.infer<typeof PageContentSchema>;
export type CopyData = z.infer<typeof CopyDataSchema>;

export const ComponentEditResponseSchema = z.object({
  astNode: ASTNodeSchema,
  tsxCode: z.string().optional().describe('The updated TSX code, ONLY if styling/layout changes were required.'),
  requiresCodeUpdate: z.boolean().describe('True if you modified the TSX code to fulfill the styling/layout request.'),
});
export type ComponentEditResponse = z.infer<typeof ComponentEditResponseSchema>;


export function buildBrandStorySchema(hasFounderStory: boolean) {
  const schemaShape: Record<string, z.ZodTypeAny> = {
    whyWeExist: z.string().describe('Why this company exists — the underlying mission and purpose.'),
    whatWeBelieve: z.string().describe('Core beliefs and values that drive the company.'),
    customerProblemAndTransformation: z.string().describe('The customer\'s problem before finding this company, and the positive transformation after.'),
    brandNarrative: z.string().describe('A compelling, cohesive brand narrative (2-3 paragraphs).'),
    storyThemes: z.array(z.string()).describe('3-5 recurring story themes to reinforce consistently.'),
    aboutUsDirection: z.string().describe('Strategic direction for writing the About Us page.'),
    storytellingPrinciples: z.array(z.string()).describe('4-6 guiding principles for brand storytelling.'),
  };

  if (hasFounderStory) {
    schemaShape.originAndFounderStory = z.string().describe(
      'The origin and founder story based on the provided user input. Do NOT embellish or add facts not present in the user input.'
    );
  }

  return z.object(schemaShape);
}
