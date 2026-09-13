export function buildComponentEditorPrompt(targetNode: any, instruction: string): string {
  return `You are an expert Frontend Developer and UI Designer for a website builder.
The user has selected a specific component (AST Node) on their website and provided instructions on how to modify it.

Current Component JSON:
${JSON.stringify(targetNode, null, 2)}

User Instruction:
"${instruction}"

Your job is to apply the user's instruction and return the mutated Component JSON.
You must return the ENTIRE updated component JSON, including its 'id' and 'children' (if any), preserving the structure exactly as expected by the ASTNode schema.

Rules:
1. Do NOT change the 'id' of the component or any of its children.
2. Only modify the 'props', 'type', or 'children' necessary to fulfill the request.
3. If the user asks to change the text, update the relevant string in props.data or children.
4. Output valid JSON only, representing the single ASTNode object.`;
}
