"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageContentSchema = exports.PageStructureSchema = exports.SectionSchema = exports.ASTNodeSchema = exports.CopyDataSchema = exports.PageSeoSchema = exports.KeywordStrategySchema = exports.SeoMetadataSchema = exports.DesignSystemSchema = exports.BrandIdentitySchema = exports.BrandVoiceSchema = void 0;
const zod_1 = require("zod");
exports.BrandVoiceSchema = zod_1.z.object({
    tone: zod_1.z.string(),
    vocabulary: zod_1.z.array(zod_1.z.string()),
    rules: zod_1.z.array(zod_1.z.string()),
});
exports.BrandIdentitySchema = zod_1.z.object({
    colors: zod_1.z.object({
        primary: zod_1.z.string(),
        secondary: zod_1.z.string(),
        accent: zod_1.z.string(),
    }),
    typography: zod_1.z.object({
        headingFont: zod_1.z.string(),
        bodyFont: zod_1.z.string(),
    }),
});
exports.DesignSystemSchema = zod_1.z.object({
    colors: zod_1.z.object({
        primary: zod_1.z.string(),
        secondary: zod_1.z.string(),
        accent: zod_1.z.string(),
        background: zod_1.z.string(),
        text: zod_1.z.string(),
    }),
    typography: zod_1.z.object({
        headingFont: zod_1.z.string(),
        bodyFont: zod_1.z.string(),
    }),
    spacing: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
exports.SeoMetadataSchema = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    keywords: zod_1.z.array(zod_1.z.string()),
    ogImagePlaceholder: zod_1.z.string(),
});
exports.KeywordStrategySchema = zod_1.z.object({
    pages: zod_1.z.array(zod_1.z.object({
        slug: zod_1.z.string(),
        primaryKeyword: zod_1.z.object({
            keyword: zod_1.z.string(),
            volume: zod_1.z.number(),
        }),
        secondaryKeywords: zod_1.z.array(zod_1.z.object({
            keyword: zod_1.z.string(),
            volume: zod_1.z.number(),
        })),
        searchIntent: zod_1.z.enum(['commercial', 'informational', 'local']),
    }))
});
exports.PageSeoSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    title: zod_1.z.string().min(30).max(60),
    description: zod_1.z.string().min(120).max(160),
    h1: zod_1.z.string(),
    keywords: zod_1.z.array(zod_1.z.string()),
    ogTitle: zod_1.z.string(),
    ogDescription: zod_1.z.string(),
    canonicalPath: zod_1.z.string(),
});
const PrimitiveTypeSchema = zod_1.z.enum(['Box', 'Typography', 'Button', 'Image', 'Grid', 'Icon', 'Section', 'Card', 'Accordion', 'Badge', 'Carousel']);
exports.CopyDataSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.any());
exports.ASTNodeSchema = zod_1.z.lazy(() => zod_1.z.object({
    type: PrimitiveTypeSchema,
    props: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    children: zod_1.z.array(zod_1.z.union([exports.ASTNodeSchema, zod_1.z.string()])).optional(),
}));
exports.SectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    ast: exports.ASTNodeSchema
});
exports.PageStructureSchema = zod_1.z.object({
    sections: zod_1.z.array(zod_1.z.string())
});
exports.PageContentSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    sections: zod_1.z.array(exports.SectionSchema)
});
//# sourceMappingURL=skill-outputs.schema.js.map