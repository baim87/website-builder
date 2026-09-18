import { SEO_RULES } from '../constants/seo.constants';

export function buildKeywordStrategyPrompt(
  businessContext: any,
  keywords: any[],
  serviceKeywords: any[],
  locationMetrics: any[],
  pages: any[],
  brandStrategy?: string,
  brandPositioning?: string
): string {
  return `You are an SEO strategist. Assign target keywords to the pages for a contractor website.

BUSINESS CONTEXT:
Trade: ${businessContext.trade}
Location: ${businessContext.location}

REAL KEYWORD DATA (from Google Ads, with actual monthly search volumes):
${JSON.stringify(keywords.slice(0, 50))} // Limiting to top 50 to avoid massive token usage

SERVICE-SPECIFIC KEYWORDS:
${JSON.stringify(serviceKeywords.map(sk => ({ service: sk.service, keywords: sk.keywords.slice(0, 10) })))}

LOCATION RADIUS KEYWORD METRICS (For Service Area Pages/Cards):
${JSON.stringify(locationMetrics)}

PAGES TO ASSIGN:
${JSON.stringify(pages)}

BRAND STRATEGY & POSITIONING:
${brandStrategy || 'Not provided'}
${brandPositioning || 'Not provided'}

RULES:
- Each page gets exactly 1 primary keyword (highest volume, most relevant to the page's intent)
- Each page gets 2-4 secondary keywords
- DO NOT assign the same primary keyword to multiple pages (no keyword cannibalization)
- Match search intent: "home" = broad commercial, "services/x" = specific service, "service-areas/x" = local
- Prioritize keywords with higher search volume, but make sure they are highly relevant to the specific page.
- Choose keywords that best align with the Brand Strategy & Positioning (e.g., if the brand is luxury/high-end, avoid "cheap" or "affordable" modifiers).

${SEO_RULES}

You MUST respond with ONLY a JSON object in this EXACT structure:
{
  "pages": [
    {
      "slug": "string (the page slug)",
      "primaryKeyword": { "keyword": "string", "volume": number },
      "secondaryKeywords": [ { "keyword": "string", "volume": number } ],
      "searchIntent": "commercial" | "informational" | "local"
    }
  ]
}`;
}
