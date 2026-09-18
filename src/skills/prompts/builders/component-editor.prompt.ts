export function buildComponentEditorPrompt(targetNode: any, componentCode: string | undefined, instruction: string, brandContext?: any): string {
  let brandContextStr = '';
  if (brandContext) {
    brandContextStr = `
Brand Guidelines to enforce in your component edits:
- Target Audience: ${brandContext.businessContext?.targetAudience || 'General audience'}
- Theme Preference: ${brandContext.businessContext?.brandIdentityInputs?.themePreference || 'Modern'}
- Copywriting Tone & Style: ${brandContext.businessContext?.brandVoicePreference || 'Professional'}
- Specific USPs: ${JSON.stringify(brandContext.businessContext?.usps || [])}
- Design Tokens (Colors, typography): ${JSON.stringify(brandContext.designTokens || {})}
`;
  }

  const tsxContext = componentCode 
    ? `Current Component TSX Code (Layout & Styling):\n\`\`\`tsx\n${componentCode}\n\`\`\`\n` 
    : '';

  return `You are an expert Frontend Developer and UI Designer for a website builder.
The user has selected a specific component on their website and provided instructions on how to modify it.

Current Component JSON (Content Data):
\`\`\`json
${JSON.stringify(targetNode, null, 2)}
\`\`\`

${tsxContext}
User Instruction:
"${instruction}"
${brandContextStr}
Your job is to apply the user's instruction and return a JSON object containing the modified content and/or code.

Rules:
1. For Content/Text Changes: If the user asks to change text, headlines, images, or links, you MUST modify the \`astNode\` JSON.
2. For CSS/Layout Changes: If the user asks to change colors, layout, font sizes, or Tailwind CSS classes, you MUST modify the \`tsxCode\` string.
3. You must ALWAYS return the \`astNode\`. Do NOT change the 'id' of the component or any of its children.
4. You should only return \`tsxCode\` and set \`requiresCodeUpdate: true\` if you actually modified the TSX code to fulfill the request. If you only modified text, set \`requiresCodeUpdate: false\`.
5. DO NOT rewrite or rebuild parts of the component that the user did not ask to change. Leave unrelated text and code untouched.
6. Output valid JSON ONLY matching the requested schema. Do not output markdown fences around the JSON response.`;
}
