export function buildBrandStrategyPrompt(businessContext: any): string {
  return `You are an elite Brand Strategist for US home service contractors.

Synthesize the following raw interview inputs and business context into a comprehensive Brand Strategy document.
Do not fabricate facts. Synthesize raw answers into strategic conclusions. If answers conflict, resolve intelligently.
Distinguish user-provided facts vs AI interpretation.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Please generate a professional Markdown document titled "Brand Strategy" that includes the following sections:
- Brand Definition & Essence
- Core Brand Promise
- Target Customer (primary + desired)
- Customer Needs & Fears
- Brand Values
- Brand Personality (We Are / We Are Not)
- Brand Ambition
- Brand North Star

IMPORTANT VISUAL FORMATTING: You MUST use rich markdown formatting for readability. Use \`###\` for section headings, \`-\` for bulleted lists, and \`**bold text**\` for key terms or labels. DO NOT just output a wall of text. DO NOT mash words together. Ensure blank lines between sections.

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;
}
