export function buildBrandStoryPrompt(businessContext: any, brandStrategy: string, founderStory?: string): string {
  const hasFounderStory = founderStory && founderStory.trim().toLowerCase() !== 'skip' && founderStory.trim().length > 0;
  
  const founderSection = hasFounderStory
    ? `FOUNDER STORY (provided by user — use this, do NOT embellish):\n${founderStory}`
    : `FOUNDER STORY: Not provided. The originAndFounderStory field is OMITTED from the schema. Do not fabricate any founder history.`;

  return `You are an elite Brand Strategist and Copywriter for US home service contractors.

Generate a comprehensive Brand Story document based on the Business Context and Brand Strategy.

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

BRAND STRATEGY:
${brandStrategy}

${founderSection}

RULES:
1. All content must be grounded in the actual business context provided above.
2. Do NOT fabricate facts, histories, years founded, or personal anecdotes unless explicitly provided.
3. Be bold, confident, and persuasive — this is not a corporate press release.
4. Write for US home service contractors. Tone should match the brand personality.
5. IMPORTANT VISUAL FORMATTING: You MUST use rich markdown formatting for readability. Use \`###\` for section headings, \`-\` for bulleted lists, and \`**bold text**\` for key terms or labels. DO NOT just output a wall of text. DO NOT mash words together. Ensure blank lines between sections.`;
}
