"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageContentSchema = exports.PageStructureSchema = exports.SectionSchema = exports.SeoMetadataSchema = exports.DesignSystemSchema = exports.BrandIdentitySchema = exports.BrandVoiceSchema = void 0;
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
const HeroSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('HeroSection'),
    content: zod_1.z.object({
        headline: zod_1.z.string(),
        subheadline: zod_1.z.string(),
        ctaText: zod_1.z.string(),
        backgroundImage: zod_1.z.string()
    })
});
const BrandsSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('BrandsSection'),
    content: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        icon: zod_1.z.string()
    }))
});
const ServicesSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('ServicesSection'),
    content: zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            slug: zod_1.z.string(),
            name: zod_1.z.string(),
            description: zod_1.z.string(),
            icon: zod_1.z.string(),
            image: zod_1.z.string()
        })).optional()
    })
});
const AboutSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('AboutSection'),
    content: zod_1.z.object({
        story: zod_1.z.string(),
        mission: zod_1.z.string(),
        values: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), description: zod_1.z.string() })),
        team: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), role: zod_1.z.string(), photo: zod_1.z.string() }))
    })
});
const WhyUsSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('WhyUsSection'),
    content: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        icon: zod_1.z.string()
    }))
});
const BeforeAfterSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('BeforeAfterSection'),
    content: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        beforeImage: zod_1.z.string(),
        afterImage: zod_1.z.string(),
        description: zod_1.z.string()
    }))
});
const TimelineSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('TimelineSection'),
    content: zod_1.z.array(zod_1.z.object({
        step: zod_1.z.number(),
        title: zod_1.z.string(),
        description: zod_1.z.string()
    }))
});
const TestimonialsSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('TestimonialsSection'),
    content: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        text: zod_1.z.string(),
        rating: zod_1.z.number(),
        avatar: zod_1.z.string().optional(),
        role: zod_1.z.string().optional(),
        projectImage: zod_1.z.string().optional()
    }))
});
const LocationsSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('LocationsSection'),
    content: zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            slug: zod_1.z.string(),
            name: zod_1.z.string(),
            description: zod_1.z.string(),
            image: zod_1.z.string()
        })).optional()
    })
});
const PageHeaderSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('PageHeaderSection'),
    content: zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        badge: zod_1.z.string().optional(),
        backgroundImage: zod_1.z.string()
    })
});
const ServiceDetailsSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('ServiceDetailsSection'),
    content: zod_1.z.object({
        overview: zod_1.z.string(),
        whyChooseUs: zod_1.z.array(zod_1.z.string()),
        process: zod_1.z.array(zod_1.z.string()),
        cta: zod_1.z.object({
            heading: zod_1.z.string(),
            subheading: zod_1.z.string(),
            buttonText: zod_1.z.string()
        })
    })
});
const CallToActionSectionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.literal('CallToActionSection'),
    content: zod_1.z.object({
        heading: zod_1.z.string(),
        subheading: zod_1.z.string(),
        buttonText: zod_1.z.string(),
        backgroundImage: zod_1.z.string().optional()
    })
});
exports.SectionSchema = zod_1.z.discriminatedUnion("type", [
    HeroSectionSchema,
    BrandsSectionSchema,
    ServicesSectionSchema,
    AboutSectionSchema,
    WhyUsSectionSchema,
    BeforeAfterSectionSchema,
    TimelineSectionSchema,
    TestimonialsSectionSchema,
    LocationsSectionSchema,
    PageHeaderSectionSchema,
    ServiceDetailsSectionSchema,
    CallToActionSectionSchema
]);
exports.PageStructureSchema = zod_1.z.object({
    sections: zod_1.z.array(zod_1.z.string())
});
exports.PageContentSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    sections: zod_1.z.array(exports.SectionSchema)
});
//# sourceMappingURL=skill-outputs.schema.js.map