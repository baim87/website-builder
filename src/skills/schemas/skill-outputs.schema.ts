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

const HeroSectionSchema = z.object({
  id: z.string(),
  type: z.literal('HeroSection'),
  content: z.object({
    headline: z.string(),
    subheadline: z.string(),
    ctaText: z.string(),
    backgroundImage: z.string()
  })
});

const BrandsSectionSchema = z.object({
  id: z.string(),
  type: z.literal('BrandsSection'),
  content: z.array(z.object({
    name: z.string(),
    icon: z.string()
  }))
});

const ServicesSectionSchema = z.object({
  id: z.string(),
  type: z.literal('ServicesSection'),
  content: z.object({
    items: z.array(z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      icon: z.string(),
      image: z.string()
    })).optional()
  })
});

const AboutSectionSchema = z.object({
  id: z.string(),
  type: z.literal('AboutSection'),
  content: z.object({
    story: z.string(),
    mission: z.string(),
    values: z.array(z.object({ title: z.string(), description: z.string() })),
    team: z.array(z.object({ name: z.string(), role: z.string(), photo: z.string() }))
  })
});

const WhyUsSectionSchema = z.object({
  id: z.string(),
  type: z.literal('WhyUsSection'),
  content: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string()
  }))
});

const BeforeAfterSectionSchema = z.object({
  id: z.string(),
  type: z.literal('BeforeAfterSection'),
  content: z.array(z.object({
    title: z.string(),
    beforeImage: z.string(),
    afterImage: z.string(),
    description: z.string()
  }))
});

const TimelineSectionSchema = z.object({
  id: z.string(),
  type: z.literal('TimelineSection'),
  content: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string()
  }))
});

const TestimonialsSectionSchema = z.object({
  id: z.string(),
  type: z.literal('TestimonialsSection'),
  content: z.array(z.object({
    name: z.string(),
    text: z.string(),
    rating: z.number(),
    avatar: z.string().optional(),
    role: z.string().optional(),
    projectImage: z.string().optional()
  }))
});

const LocationsSectionSchema = z.object({
  id: z.string(),
  type: z.literal('LocationsSection'),
  content: z.object({
    items: z.array(z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      image: z.string()
    })).optional()
  })
});

const PageHeaderSectionSchema = z.object({
  id: z.string(),
  type: z.literal('PageHeaderSection'),
  content: z.object({
    title: z.string(),
    description: z.string().optional(),
    badge: z.string().optional(),
    backgroundImage: z.string()
  })
});

const ServiceDetailsSectionSchema = z.object({
  id: z.string(),
  type: z.literal('ServiceDetailsSection'),
  content: z.object({
    overview: z.string(),
    whyChooseUs: z.array(z.string()),
    process: z.array(z.string()),
    cta: z.object({
      heading: z.string(),
      subheading: z.string(),
      buttonText: z.string()
    })
  })
});

const CallToActionSectionSchema = z.object({
  id: z.string(),
  type: z.literal('CallToActionSection'),
  content: z.object({
    heading: z.string(),
    subheading: z.string(),
    buttonText: z.string(),
    backgroundImage: z.string().optional()
  })
});

export const SectionSchema = z.discriminatedUnion("type", [
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

export const PageStructureSchema = z.object({
  sections: z.array(z.string())
});

// Used for backwards compatibility if we ever validate an entire page at once
export const PageContentSchema = z.object({
  slug: z.string(),
  sections: z.array(SectionSchema)
});
