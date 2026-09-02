import { z } from 'zod';
export declare const BrandVoiceSchema: z.ZodObject<{
    tone: z.ZodString;
    vocabulary: z.ZodArray<z.ZodString>;
    rules: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const BrandIdentitySchema: z.ZodObject<{
    colors: z.ZodObject<{
        primary: z.ZodString;
        secondary: z.ZodString;
        accent: z.ZodString;
    }, z.core.$strip>;
    typography: z.ZodObject<{
        headingFont: z.ZodString;
        bodyFont: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DesignSystemSchema: z.ZodObject<{
    colors: z.ZodObject<{
        primary: z.ZodString;
        secondary: z.ZodString;
        accent: z.ZodString;
        background: z.ZodString;
        text: z.ZodString;
    }, z.core.$strip>;
    typography: z.ZodObject<{
        headingFont: z.ZodString;
        bodyFont: z.ZodString;
    }, z.core.$strip>;
    spacing: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export declare const SeoMetadataSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    keywords: z.ZodArray<z.ZodString>;
    ogImagePlaceholder: z.ZodString;
}, z.core.$strip>;
export declare const KeywordStrategySchema: z.ZodObject<{
    pages: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        primaryKeyword: z.ZodObject<{
            keyword: z.ZodString;
            volume: z.ZodNumber;
        }, z.core.$strip>;
        secondaryKeywords: z.ZodArray<z.ZodObject<{
            keyword: z.ZodString;
            volume: z.ZodNumber;
        }, z.core.$strip>>;
        searchIntent: z.ZodEnum<{
            commercial: "commercial";
            informational: "informational";
            local: "local";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PageSeoSchema: z.ZodObject<{
    slug: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    h1: z.ZodString;
    keywords: z.ZodArray<z.ZodString>;
    ogTitle: z.ZodString;
    ogDescription: z.ZodString;
    canonicalPath: z.ZodString;
}, z.core.$strip>;
export declare const CopyDataSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
export declare const ASTNodeSchema: z.ZodType<any>;
export declare const SectionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    ast: z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>;
}, z.core.$strip>;
export declare const PageStructureSchema: z.ZodObject<{
    sections: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const PageContentSchema: z.ZodObject<{
    slug: z.ZodString;
    sections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        ast: z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DesignSystem = z.infer<typeof DesignSystemSchema> & {
    globalCss?: string;
};
export type ASTNode = z.infer<typeof ASTNodeSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type PageContent = z.infer<typeof PageContentSchema>;
export type CopyData = z.infer<typeof CopyDataSchema>;
