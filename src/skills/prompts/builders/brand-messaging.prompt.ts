export function buildBrandMessagingPrompt(businessContext: any, brandStrategy: string, brandPositioning?: string): string {
  return `You are an elite Brand Strategist for US home service contractors.

Generate a comprehensive Brand Messaging document based on the Business Context, Brand Strategy, and Brand Positioning.
Do not fabricate facts. Focus on actionable, customer-facing messaging.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Brand Positioning (if available):
${brandPositioning || 'Not provided'}

Please generate a professional Markdown document titled "Brand Messaging" that includes the following sections:
- Core Message & Value Proposition
- Brand Promise
- Key Differentiators & Proof Points
- Customer-Facing Messages (hero, CTA, trust, why-us, about-us, service)
- Messaging Pillars (3)
- Key Phrases
- Messages to Avoid

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;
}
