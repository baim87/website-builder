export function buildPageStructurePrompt(
  pageSlug: string,
  businessContext: any,
  brandVoice?: string,
  brandStrategy?: string,
  brandPositioning?: string
): string {
  return `Determine the layout for the "${pageSlug}" page of this contractor business.
Business Context: ${JSON.stringify(businessContext)}
Brand Voice: ${JSON.stringify(brandVoice || 'Not provided')}
Brand Strategy: ${JSON.stringify(brandStrategy || 'Not provided')}
Brand Positioning: ${JSON.stringify(brandPositioning || 'Not provided')}

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "sections": ["HeroSection", "ServicesSection", "AboutSection"]
}

SUPPORTED SECTION TYPES (You can ONLY pick from these):
- AnnouncementBarSection: Used to display seasonal offers or urgent messages at the very top of the page.
- HeroSection: Used for top-of-page introductions on the home page.
- PageHeaderSection: Used for the smaller hero section at the top of detail pages (like service or location details).
- BrandsSection: Used to display trust badges, certifications, or partner logos.
- ServicesSection: Used to list services offered.
- AboutSection: Used for company history and team presentation.
- WhyUsSection: Used for value propositions and differentiators.
- BeforeAfterSection: Used to showcase project transformations.
- TimelineSection: Used to explain the process step-by-step.
- TestimonialsSection: Used for social proof and client reviews.
- LocationsSection: Used to list service areas.
- ServiceDetailsSection: Used for the detailed content body of a specific service.
- CallToActionSection: Used for the large bottom CTA block commonly found on pages.

Do not invent new section types. Just output the array of strings wrapped in the JSON object.`;
}
