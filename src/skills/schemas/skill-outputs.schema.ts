import { z } from 'zod';

export const BrandVoiceSchema = z.object({
  tone: z.string(),
  vocabulary: z.array(z.string()),
  rules: z.array(z.string()),
});

export const BrandIdentitySchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
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
});

const PrimitiveTypeSchema = z.string();

export const CopyDataSchema = z.record(z.string(), z.any());

export const ASTNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
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

