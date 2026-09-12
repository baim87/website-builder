import { COPYWRITING_RULES } from '../constants/copywriting.constants';

export interface CopyWriterContext {
  sectionType: string;
  businessContext: any;
  brandVoice?: any;
  seoMeta?: any;
  pageSlug: string;
  validRoutes?: string[];
  isLocationServicePage?: boolean;
  projectAssets?: any[];
}

export function buildCopyWriterPrompt(context: CopyWriterContext, locationMetrics: any[] = [], projectId?: string): string {
  const { sectionType, businessContext, brandVoice, seoMeta, pageSlug, validRoutes, isLocationServicePage, projectAssets } = context;

  const keywordsContext = seoMeta?.keywords ? `TARGET SEO KEYWORDS TO INCLUDE: ${seoMeta.keywords.join(', ')}` : '';
  
  let sectionSpecificRules = '';
  
  if (sectionType === 'AboutSection') {
    const ownerName = businessContext.contactPerson || 'The Owner';
    const bizName = businessContext.businessName || 'our company';
    const ownerPortraitRule = businessContext.ownerPortraitUrl 
      ? `\nIMPORTANT IMAGE RULE: You MUST set the "image" field exactly to "${businessContext.ownerPortraitUrl}". Do NOT use an UNSPLASH placeholder for this section.`
      : '';
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Write the About Us section strictly in the first-person ("I"), from the perspective of the business owner (${ownerName}). Use a warm, highly personal, story-driven tone (e.g., "Hi! I'm ${ownerName}, the owner of ${bizName}. After years of experience..."). Focus on their personal expertise, passion, and dedication to delivering stress-free results for the customer.${ownerPortraitRule}`;
  } else if (sectionType === 'WhyUsSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Highlight Unique Selling Propositions (USPs).`;
  } else if (sectionType === 'GallerySection') {
    let galleryRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY 4 or EXACTLY 8 images (a multiple of 4) to maintain a perfectly balanced bento grid layout. Generate a highly descriptive caption and use a relevant Unsplash placeholder URL (e.g., "UNSPLASH:luxury modern bathroom") for the "image" field for the services listed in the business context.`;
    if (pageSlug === 'portfolio') {
      galleryRules += `\n9. IMPORTANT PORTFOLIO RULE: Generate specific portfolio case studies.`;
    }
    sectionSpecificRules = galleryRules;
  } else if (sectionType === 'TimelineSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate a MAXIMUM of 4 process steps.`;
  } else if (sectionType === 'PageHeaderSection') {
    let headerRules = `8. SECTION SPECIFIC RULES: This is for an inner page. Generate a shorter, punchy headline and a brief subtitle without a massive call to action like a primary Hero. Write engaging, straight-to-the-point copy designed to hook the customer. Keep the text length carefully balanced so the layout looks visually pleasing (e.g. avoid long sentences that leave a single orphaned word on a new line).`;
    if (pageSlug.startsWith('services/') || (pageSlug.startsWith('service-areas/') && pageSlug.split('/').length >= 3)) {
      const phone = businessContext.phone || '(555) 555-5555';
      headerRules += `\n9. IMPORTANT CTA RULE: For this specific service page, you MUST generate 2 Call To Action buttons. The first MUST be "primaryCtaText" linking to "/contact" via "primaryCtaLink". The second MUST be "secondaryCtaText" displaying the phone number (e.g. "Call ${phone}") linking to "tel:${phone.replace(/[^0-9]/g, '')}" via "secondaryCtaLink".`;
    }
    sectionSpecificRules = headerRules;
  } else if (sectionType === 'HeroSection') {
    let heroRules = `8. SECTION SPECIFIC RULES: Generate a strong, conversion-optimized hero headline. Include a primary Call to Action (CTA) using the "primaryCtaText" and "primaryCtaLink" fields. Also populate the new premium layout fields: eyebrow, trustMarks (e.g., ["Licensed & Insured", "On-Time Builds"]), reviewSnippet (e.g., {rating: 4.9, text: "rating from local homeowners"}), and floatingStat (e.g., {value: "320+", label: "Projects completed"}). For any avatars or stat images, use UNSPLASH queries.`;
    if (pageSlug === 'portfolio') {
      heroRules += `\n9. IMPORTANT PORTFOLIO RULE: Mention specific services like ${businessContext.services?.join(', ')}.`;
    } else if (pageSlug === 'service-areas') {
      heroRules += `\n9. IMPORTANT SERVICE AREAS RULE: You MUST explicitly mention the target service areas (from the business context) that have high search volume within the Hero copy.`;
    }
    sectionSpecificRules = heroRules;
  } else if (sectionType === 'BrandsSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate a list of partner brands using the logos provided in the AVAILABLE PROJECT ASSETS. You MUST use "ASSET:[id]" for their logos. If you absolutely must generate additional generic certifications (e.g., BBB, HomeAdvisor) that are not in the assets, you may fallback to "UNSPLASH:certification logo".`;
  } else if (sectionType === 'ServicesSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate copy for EVERY service listed in the business context 'services' array.`;
  } else if (sectionType === 'LocationsSection') {
    const validRoutesStr = validRoutes
      ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for links):\n${validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
      : '';
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Generate copy for EVERY service area listed in the business context 'serviceAreas' array. IMPORTANT: You MUST strictly use one of the provided valid routes for the 'link' field for each location (e.g., /service-areas/[city]/[service]). Do not invent or guess URLs. You MUST provide a highly relevant Unsplash placeholder URL (e.g., "UNSPLASH:suburban house" or "UNSPLASH:city skyline") for the "image" field for every location. Do NOT output raw city names for the image field.${validRoutesStr}`;
  } else if (sectionType === 'FaqSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate between 3 and 6 relevant Frequently Asked Questions in the "faqs" array.`;
  } else if (sectionType === 'HeaderSection') {
    const validRoutesStr = validRoutes
      ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for navLinks):\n${validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
      : '';
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: This is the primary top navigation bar. Do NOT generate a large headline or hero copy. You MUST output a "navLinks" array. For sub-pages like /services/[x] or /service-areas/[x], you MUST group them under a parent link (e.g. "Services") using the "subLinks" array. Use the "ctaText" and "ctaLink" fields for the primary contact button. NEVER use SaaS terminology. You MUST include a "logoUrl" field mapped to the logoUrl from the business context, and a "logoText" field for fallback.${validRoutesStr}`;
  } else if (sectionType === 'FooterSection') {
    const validRoutesStr = validRoutes
      ? `\nVALID PAGE ROUTES (use ONLY these exact slugs for quickLinks and serviceLinks):\n${validRoutes.map((r: string) => `- /${r === 'home' ? '' : r}`).join('\n')}`
      : '';
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: This is the website footer. Do NOT generate massive headlines. You MUST output a "quickLinks" array for general navigation (e.g. Home, About, Contact, Privacy, etc.) AND a separate "serviceLinks" array specifically for core service pages ONLY (e.g. Deck Building, Deck Repair). Do NOT include location/city-specific routes in serviceLinks. Include copyright text in the "copyright" field. You MUST also generate "developerCredit" EXACTLY as "Contractor Website by Local Empire" and "developerLink" EXACTLY as "https://localempire.com/". You MUST include a "logoUrl" field mapped to the logoUrl from the business context. For "socialLinks", ALWAYS generate standard social media platforms (e.g., Facebook, Instagram, YouTube) with placeholder URLs if real ones aren't provided. Do NOT use "Google" or "Website" as social links.${validRoutesStr}`;
  } else if (sectionType === 'FindUsSection' || sectionType === 'ContactSection') {
    let mapRule = '';
    if (sectionType === 'FindUsSection') {
      mapRule = ` You MUST also generate a "mapUrl" field containing a valid Google Maps embed URL. IMPORTANT: Even if the businessContext contains a GBP mapUrl, do NOT use it directly because it blocks iframes. You MUST construct the embed URL manually using the business address formatted EXACTLY like this: https://maps.google.com/maps?q=[URL_ENCODED_ADDRESS]&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: Ensure the exact address, phone, email, and hours from the business context are included. 
    - IMPORTANT HOURS FORMATTING: Do NOT just copy and paste the raw hours array/string blindly. Intelligently format and consolidate the operating hours into a concise, human-readable format. Group days with identical hours (e.g., "Mon-Fri: 7:00 AM - 5:00 PM | Sat-Sun: Closed" or "Mon-Sun: 9:00 AM - 7:00 PM"). Use the actual hours provided in the businessContext, but make them clean and compact.${mapRule}`;
  } else if (sectionType === 'TestimonialsSection') {
    const contactName = businessContext.contactPerson || 'the owner';
    const bizName = businessContext.businessName || 'this company';
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY 9 highly realistic, detailed testimonials relevant to the target services. 
    - Ratings MUST be varied (e.g., 4.8, 4.9, 5.0).
    - The "quote" field MUST explicitly mention the contact person ("${contactName}") or the business name ("${bizName}") in a natural way.
    - You MUST wrap the most impactful phrases in the "quote" field with <strong> tags (e.g., "They were <strong>fast, affordable, and professional</strong>").
    - Make sure you include a "sectionTitle" field at the root level of the JSON.`;
  } else if (sectionType === 'LeadFormSection') {
    sectionSpecificRules = `8. SECTION SPECIFIC RULES: You MUST generate EXACTLY the following form fields in the "fields" array: 
    - "First Name" (type: text, required: true)
    - "Last Name" (type: text, required: true)
    - "Phone" (type: tel, required: true)
    - "Email" (type: email, required: true)
    - "Address" (type: text, required: true)
    - "City" (type: text, required: false)
    - "Postal Code" (type: text, required: true)
    - "Upload Photos Here" (type: file, required: false)
    - "Briefly Describe Your New Project" (type: textarea, required: false)
    Do NOT invent random fields. Use these exact labels. IMPORTANT: Do NOT include an asterisk (*) in the label string. Set the "required" boolean to true/false as specified above.`;
  }

  let locationMetricsStr = '';
  if (pageSlug === 'service-areas' && projectId && locationMetrics.length > 0) {
    locationMetricsStr = `\nLOCATION KEYWORD METRICS:\n${JSON.stringify(locationMetrics, null, 2)}\nIMPORTANT: Use these highest volume keywords specifically for the location cards and hero copy!`;
  }

  let locationServiceRules = '';
  
  let targetService = '';
  if (pageSlug.startsWith('services/') || isLocationServicePage) {
    const parts = pageSlug.split('/');
    const rawServiceSlug = parts.length === 2 ? parts[1] : parts[parts.length - 1];
    targetService = rawServiceSlug.replace(/-/g, ' ');
    
    locationServiceRules += `\nCRITICAL CONTEXT:\nThis page is STRICTLY dedicated to "${targetService}". ALL content generated for this section MUST exclusively talk about "${targetService}".`;
  }

  if (isLocationServicePage) {
    const citySlug = pageSlug.split('/')[1]; // service-areas/[city]/[service]
    const targetCity = citySlug.replace(/-/g, ' ');
    locationServiceRules += `\n\nFurthermore, this is a highly localized Service Area Detail page. You must explicitly mention BOTH the specific Service ("${targetService}") and the specific City ("${targetCity}") throughout the copy to maximize local SEO relevance.`;
  }

let projectAssetsStr = '';
  if (projectAssets && projectAssets.length > 0) {
    projectAssetsStr = `\nAVAILABLE PROJECT ASSETS:\n${JSON.stringify(projectAssets, null, 2)}\nIMPORTANT: You have pre-planned image assets available above. When you need an image, you MUST try to find a relevant asset ID from the list above and output "ASSET:[id]". Only if no suitable asset exists should you fallback to "UNSPLASH:query".`;
  }

  return `You are an expert full-stack developer, copywriter, and UI designer for a contractor website.
Write the UI AST and copy for a "${sectionType}".

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND VOICE:
${JSON.stringify(brandVoice || {}, null, 2)}

${keywordsContext}
${locationMetricsStr}
${locationServiceRules}
${projectAssetsStr}

RULES:
1. You MUST generate the exact text required for the section.
2. For images, prioritize using the provided Project Assets by outputting "ASSET:[id]". If no appropriate asset is available, generate an Unsplash query string formatted as "UNSPLASH:query". Do not use raw URLs for images.
3. Write compelling, high-converting copy that matches the brand voice.
4. Output a single JSON object containing all text and data, strictly following the provided schema.
5. Provide a flexible structure that a UI Designer can easily map into a layout.
6. IMPORTANT: If a section includes buttons, cards, or actionable items, you MUST include a relative URL path (e.g., '/services', '/contact', '/portfolio') in a 'link' or 'href' field.
7. CRITICAL CTA RULE: NEVER use SaaS terminology like "Watch Demo", "Start for Free", or "Free Trial". This is a local service contractor website. All CTAs MUST be lead generation focused (e.g., "Get a Quote", "Request an Estimate", "Call Now", "Book a Consultation").
8. UNIQUENESS RULE: You MUST ensure the copywriting is completely unique for this specific project. Avoid generic industry clichés. Tailor the tone deeply to the brand personality and do not recycle the exact same headlines or phrasing used in generic templates.
${sectionSpecificRules}

${COPYWRITING_RULES}
`;
}
