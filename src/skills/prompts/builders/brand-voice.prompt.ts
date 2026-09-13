export function buildBrandVoicePrompt(businessContext: any, brandStrategy: string): string {
  return `You are an elite Brand Strategist and Copywriter for US home service contractors.

Generate a comprehensive Brand Voice profile based on the Business Context and Brand Strategy.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Brand Strategy:
${brandStrategy}

Please generate a professional Markdown document titled "Brand Voice" that includes the following sections:
- Voice Definition & Personality
- Tone (We Sound Like / We Don't Sound Like)
- Communication Principles
- Writing Style (sentence style, vocabulary, preferred/avoided language)
- Customer Communication (sales, website, service, complaints)
- Examples (We Say / We Don't Say)
- Voice North Star

Output ONLY the markdown content. No conversational wrapper or markdown fences wrapping the entire output.`;
}
