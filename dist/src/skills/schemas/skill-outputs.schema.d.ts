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
export declare const SectionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"HeroSection">;
    content: z.ZodObject<{
        headline: z.ZodString;
        subheadline: z.ZodString;
        ctaText: z.ZodString;
        backgroundImage: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"BrandsSection">;
    content: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        icon: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"ServicesSection">;
    content: z.ZodObject<{
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            name: z.ZodString;
            description: z.ZodString;
            icon: z.ZodString;
            image: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"AboutSection">;
    content: z.ZodObject<{
        story: z.ZodString;
        mission: z.ZodString;
        values: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>;
        team: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            role: z.ZodString;
            photo: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"WhyUsSection">;
    content: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        icon: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"BeforeAfterSection">;
    content: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        beforeImage: z.ZodString;
        afterImage: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"TimelineSection">;
    content: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"TestimonialsSection">;
    content: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        text: z.ZodString;
        rating: z.ZodNumber;
        avatar: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodString>;
        projectImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"LocationsSection">;
    content: z.ZodObject<{
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            name: z.ZodString;
            description: z.ZodString;
            image: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"PageHeaderSection">;
    content: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        badge: z.ZodOptional<z.ZodString>;
        backgroundImage: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"ServiceDetailsSection">;
    content: z.ZodObject<{
        overview: z.ZodString;
        whyChooseUs: z.ZodArray<z.ZodString>;
        process: z.ZodArray<z.ZodString>;
        cta: z.ZodObject<{
            heading: z.ZodString;
            subheading: z.ZodString;
            buttonText: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"CallToActionSection">;
    content: z.ZodObject<{
        heading: z.ZodString;
        subheading: z.ZodString;
        buttonText: z.ZodString;
        backgroundImage: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
export declare const PageStructureSchema: z.ZodObject<{
    sections: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const PageContentSchema: z.ZodObject<{
    slug: z.ZodString;
    sections: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"HeroSection">;
        content: z.ZodObject<{
            headline: z.ZodString;
            subheadline: z.ZodString;
            ctaText: z.ZodString;
            backgroundImage: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"BrandsSection">;
        content: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            icon: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"ServicesSection">;
        content: z.ZodObject<{
            items: z.ZodOptional<z.ZodArray<z.ZodObject<{
                slug: z.ZodString;
                name: z.ZodString;
                description: z.ZodString;
                icon: z.ZodString;
                image: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"AboutSection">;
        content: z.ZodObject<{
            story: z.ZodString;
            mission: z.ZodString;
            values: z.ZodArray<z.ZodObject<{
                title: z.ZodString;
                description: z.ZodString;
            }, z.core.$strip>>;
            team: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                role: z.ZodString;
                photo: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"WhyUsSection">;
        content: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            icon: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"BeforeAfterSection">;
        content: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            beforeImage: z.ZodString;
            afterImage: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"TimelineSection">;
        content: z.ZodArray<z.ZodObject<{
            step: z.ZodNumber;
            title: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"TestimonialsSection">;
        content: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            text: z.ZodString;
            rating: z.ZodNumber;
            avatar: z.ZodOptional<z.ZodString>;
            role: z.ZodOptional<z.ZodString>;
            projectImage: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"LocationsSection">;
        content: z.ZodObject<{
            items: z.ZodOptional<z.ZodArray<z.ZodObject<{
                slug: z.ZodString;
                name: z.ZodString;
                description: z.ZodString;
                image: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"PageHeaderSection">;
        content: z.ZodObject<{
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            badge: z.ZodOptional<z.ZodString>;
            backgroundImage: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"ServiceDetailsSection">;
        content: z.ZodObject<{
            overview: z.ZodString;
            whyChooseUs: z.ZodArray<z.ZodString>;
            process: z.ZodArray<z.ZodString>;
            cta: z.ZodObject<{
                heading: z.ZodString;
                subheading: z.ZodString;
                buttonText: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        type: z.ZodLiteral<"CallToActionSection">;
        content: z.ZodObject<{
            heading: z.ZodString;
            subheading: z.ZodString;
            buttonText: z.ZodString;
            backgroundImage: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>;
