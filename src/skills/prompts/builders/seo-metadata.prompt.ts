export function buildSeoMetadataPrompt(
  businessContext: any,
  pageSlug: string,
  primaryKeyword: string,
  secondaryKeywords: string[],
  availableAssets: string,
  brandPositioning?: string,
  brandMessaging?: string,
): string {
  return `Generate SEO metadata for a specific page of this contractor website.

BUSINESS CONTEXT:
${JSON.stringify(businessContext)}

BRAND POSITIONING & MESSAGING:
${brandPositioning || 'Not provided'}
${brandMessaging || 'Not provided'}

PAGE SLUG: /${pageSlug}

TARGET KEYWORDS:
Primary Keyword: "${primaryKeyword}" (MUST be used in Title and H1)
Secondary Keywords: ${secondaryKeywords.join(', ')}

AVAILABLE IMAGES (for JSON-LD / og:image):
${availableAssets || 'No specific images available, use a generic placeholder.'}

RULES:
1. The title MUST be 30-60 characters and MUST contain the Primary Keyword.
2. The description MUST be 120-160 characters.
3. The H1 MUST contain the Primary Keyword.
4. Make it compelling for a user searching for these services, leveraging the Brand Positioning and Messaging.
5. If available images are provided, select the most relevant 'ASSET:uuid' for the 'image' field. If none are relevant, omit the image field or use a generic UNSPLASH string.

You MUST respond with ONLY a JSON object in this EXACT structure (no other text):
{
  "slug": "${pageSlug}",
  "title": "string (30-60 chars, includes primary keyword)",
  "description": "string (120-160 chars)",
  "h1": "string (includes primary keyword)",
  "keywords": ["string (primary + secondaries)"],
  "ogTitle": "string",
  "ogDescription": "string",
  "canonicalPath": "/${pageSlug}",
  "image": "string (ASSET:uuid or UNSPLASH:query)"
}`;
}
