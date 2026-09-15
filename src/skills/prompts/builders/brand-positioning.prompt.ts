export function buildBrandPositioningPrompt(businessContext: any, brandStrategy: string): string {
  return `You are an elite Brand Strategist for US home service contractors.

Based on the provided Business Context and Brand Strategy, generate a comprehensive Brand Positioning document.
Do not fabricate facts. Focus on positioning the brand effectively in its market.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Please generate a professional Markdown document titled "Brand Positioning" that includes the following sections:
- Category & Positioning Statement
- Market Position
- Primary & Supporting Differentiators
- Customer Problem & Fear
- Competitive Context (competitors, patterns, whitespace)
- Proof Points & Trust Signals

IMPORTANT VISUAL FORMATTING: You MUST use rich markdown formatting for readability. Use \`###\` for section headings, \`-\` for bulleted lists, and \`**bold text**\` for key terms or labels. DO NOT just output a wall of text. DO NOT mash words together. Ensure blank lines between sections.

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;
}
