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

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;
}
