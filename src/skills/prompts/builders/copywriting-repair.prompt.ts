export function buildCopywritingRepairPrompt(sectionType: string, brokenData: any, critique: string[], brandStrategy?: any, brandVoice?: any): string {
  return `
You are a senior copywriter for US home service contractors (roofers, plumbers, landscapers, etc.).
A visual QA AI has reviewed the website and found issues with the copywriting in the \`${sectionType}\` component.

Critique / Issues to fix:
${critique.map(c => `- ${c}`).join('\n')}

Here is the current JSON data for this section:
${JSON.stringify(brokenData, null, 2)}

${brandStrategy ? `BRAND STRATEGY CONTEXT:
${JSON.stringify(brandStrategy, null, 2)}` : ''}

${brandVoice ? `BRAND VOICE CONTEXT:
${JSON.stringify(brandVoice, null, 2)}` : ''}

Your task is to fix the text to address the critique.
RULES:
1. ONLY modify the text fields (e.g. headlines, paragraphs, button labels).
2. DO NOT change the JSON structure or remove/add keys. Keep the exact same shape.
3. DO NOT change image URLs or asset IDs.
4. If the critique says it sounds like SaaS, rewrite it to sound rugged, professional, and targeted at local homeowners.
5. If there is lorem ipsum or generic placeholders, replace them with realistic contractor copy.

Return the completely fixed JSON object.
`;
}
