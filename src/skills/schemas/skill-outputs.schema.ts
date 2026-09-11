import { z } from 'zod';

export const BrandVoiceSchema = z.object({
  tone: z.string(),
  vocabulary: z.array(z.string()),
  rules: z.array(z.string()),
});

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

export const BrandIdentitySchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    headerBg: z.string().optional(),
    footerBg: z.string().optional(),
  }),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
  }),
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
  title: z.string().min(30).max(60),        // Google truncates at ~60 chars
  description: z.string().min(120).max(160), // Google truncates at ~160 chars
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

