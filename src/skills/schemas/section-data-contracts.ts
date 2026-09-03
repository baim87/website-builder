import { z } from 'zod';

// SINGLE SOURCE OF TRUTH FOR COMPONENT DATA SHAPES

// Base components
const ImageSchema = z.string().describe('URL or UNSPLASH:query of the image');

// Reusable item schemas
const ServiceItemSchema = z.object({
  title: z.string().describe('Name of the service (e.g. Deck Installation)'),
  description: z.string().describe('Short description of the service'),
  icon: z.string().optional().describe('Optional icon identifier'),
  image: ImageSchema.optional().describe('Representative image of the service'),
  link: z.string().describe('URL slug to the detailed service page (e.g. /services/deck-installation)'),
});

const LocationItemSchema = z.object({
  city: z.string().describe('City name (e.g. Omaha)'),
  state: z.string().describe('State abbreviation (e.g. NE)'),
  description: z.string().describe('Short description of services offered in this location'),
  image: ImageSchema.optional().describe('Image representing the location'),
  link: z.string().describe('URL slug to the location page (e.g. /service-areas/omaha/deck-building)'),
});

const TestimonialItemSchema = z.object({
  name: z.string().describe('Customer name'),
  location: z.string().describe('Customer location (e.g. Omaha, NE)'),
  quote: z.string().describe('The actual testimonial quote from the customer. Wrap the main Unique Selling Proposition (USP) in <strong> tags.'),
  rating: z.number().min(1).max(5).describe('Star rating 1-5'),
});

const PortfolioItemSchema = z.object({
  title: z.string().describe('Project title (e.g. Modern Cedar Deck)'),
  description: z.string().describe('Short description of the project'),
  image: ImageSchema.describe('Image of the completed project'),
});

// Section Data Schemas
export const SectionDataSchemaRegistry = {
  HeaderSection: z.object({
    logoText: z.string(),
    logoUrl: z.string().optional().describe('URL to the business logo image'),
    phone: z.string(),
    navLinks: z.array(z.object({
      label: z.string(),
      href: z.string(),
    })).describe('Main navigation links. Use EXACTLY the slugs provided in the layoutContext.'),
    ctaText: z.string(),
    ctaLink: z.string(),
  }),

  FooterSection: z.object({
    companyName: z.string(),
    logoUrl: z.string().optional().describe('URL to the business logo image'),
    description: z.string(),
    phone: z.string(),
    email: z.string(),
    address: z.string(),
    quickLinks: z.array(z.object({
      label: z.string(),
      href: z.string(),
    })).describe('Footer quick links. Use EXACTLY the slugs provided in the layoutContext.'),
    socialLinks: z.array(z.object({
      platform: z.string(),
      url: z.string(),
    })).optional(),
    copyright: z.string(),
  }),

  HeroSection: z.object({
    headline: z.string().describe('Main H1 headline'),
    subheadline: z.string().describe('Supporting paragraph text'),
    primaryCtaText: z.string(),
    primaryCtaLink: z.string(),
    secondaryCtaText: z.string().optional(),
    secondaryCtaLink: z.string().optional(),
    backgroundImage: ImageSchema,
  }),

  ServicesSection: z.object({
    sectionTitle: z.string().describe('e.g. Our Services'),
    sectionDescription: z.string().optional(),
    services: z.array(ServiceItemSchema).describe('List of services offered'),
  }),

  LocationsSection: z.object({
    sectionTitle: z.string().describe('e.g. Areas We Serve'),
    sectionDescription: z.string().optional(),
    locations: z.array(LocationItemSchema).describe('List of locations served'),
  }),

  TestimonialsSection: z.object({
    sectionTitle: z.string().describe('e.g. What Our Customers Say'),
    sectionDescription: z.string().optional(),
    testimonials: z.array(TestimonialItemSchema),
  }),

  PortfolioSection: z.object({
    sectionTitle: z.string().describe('e.g. Our Recent Work'),
    sectionDescription: z.string().optional(),
    projects: z.array(PortfolioItemSchema),
  }),

  ContactSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    phone: z.string(),
    email: z.string(),
    address: z.string(),
    businessHours: z.string(),
  }),

  ContentSection: z.object({
    title: z.string(),
    content: z.string().describe('Rich HTML content (paragraphs, lists, bold text)'),
    image: ImageSchema.optional(),
    imagePosition: z.enum(['left', 'right']).optional(),
  }),

  AboutSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    content: z.string().describe('The story/about us text'),
    image: ImageSchema.optional(),
    callToAction: z.object({
      text: z.string(),
      href: z.string(),
    }).optional(),
  }),

  WhyUsSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    items: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
    })).describe('List of value propositions/USPs'),
  }),

  TimelineSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    steps: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).describe('Process steps'),
  }),

  GallerySection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    images: z.array(z.object({
      image: ImageSchema,
      caption: z.string().optional(),
    })),
  }),

  FaqSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })),
  }),

  CallToActionSection: z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    callToAction: z.object({
      text: z.string(),
      href: z.string(),
    }),
  }),

  LeadFormSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string().describe('e.g. text, email, tel, textarea'),
      label: z.string(),
      required: z.boolean(),
    })),
    submitText: z.string(),
  }),

  BeforeAfterSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    comparisons: z.array(z.object({
      beforeImage: ImageSchema,
      afterImage: ImageSchema,
      title: z.string().optional(),
      description: z.string().optional(),
    })),
  }),

  FindUsSection: z.object({
    sectionTitle: z.string(),
    sectionDescription: z.string().optional(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    hours: z.string(),
    mapUrl: z.string().optional(),
  }),

  PageHeaderSection: z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    backgroundImage: ImageSchema.optional(),
  }),

  ServiceDetailsSection: z.object({
    title: z.string(),
    content: z.string().describe('Rich HTML content explaining the service in detail'),
    image: ImageSchema.optional(),
    features: z.array(z.string()).optional().describe('List of key features or benefits'),
  }),

  BrandsSection: z.object({
    sectionTitle: z.string().optional(),
    brands: z.array(z.object({
      name: z.string(),
      logo: ImageSchema,
    })),
  }),
};
