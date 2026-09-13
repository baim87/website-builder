import { SectionDataSchemaRegistry } from '../../schemas/section-data-contracts';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { getThemeById } from '../../constants/theme-definitions.constant';

export function buildCodeRepairPrompt(
  targetComponent: string,
  brokenCode: string,
  errorLog?: string,
  critique?: string | string[],
  themePreference?: string,
  designTokens?: any
): string {
  const theme = themePreference ? getThemeById(themePreference) : undefined;
  let themeHints = '';

  if (designTokens && designTokens.colors) {
    themeHints += `\nBRAND DESIGN TOKENS:\n`;
    themeHints += `COLORS (HEX — for aesthetic reference only, DO NOT hardcode in Tailwind classes):\n`;
    themeHints += `- Primary: ${designTokens.colors.primary}\n`;
    themeHints += `- Secondary: ${designTokens.colors.secondary}\n`;
    themeHints += `- Accent: ${designTokens.colors.accent}\n`;
    themeHints += `- Background: ${designTokens.colors.background}\n`;
    themeHints += `- Surface Dark: ${designTokens.colors.surfaceDark}\n`;
  }

  if (designTokens && designTokens.typography) {
    themeHints += `\nTYPOGRAPHY:\n`;
    themeHints += `- Heading Font: ${designTokens.typography.headingFont || 'Inter'}\n`;
    themeHints += `- Body Font: ${designTokens.typography.bodyFont || 'Inter'}\n`;
    if (designTokens.typography.baseFontSize) themeHints += `- Base Font Size: ${designTokens.typography.baseFontSize}\n`;
    if (designTokens.typography.headingWeight) themeHints += `- Heading Weight: ${designTokens.typography.headingWeight}\n`;
  }

  if (designTokens && designTokens.spacing) {
    themeHints += `\nSPACING:\n`;
    if (designTokens.spacing.sectionPadding) themeHints += `- Section Padding: ${designTokens.spacing.sectionPadding}\n`;
    if (designTokens.spacing.containerMaxWidth) themeHints += `- Container Max Width: ${designTokens.spacing.containerMaxWidth}\n`;
  }

  if (designTokens && designTokens.borderRadius) {
    themeHints += `\nBORDER RADIUS:\n`;
    if (designTokens.borderRadius.default) themeHints += `- Default: ${designTokens.borderRadius.default}\n`;
    if (designTokens.borderRadius.button) themeHints += `- Button: ${designTokens.borderRadius.button}\n`;
    if (designTokens.borderRadius.card) themeHints += `- Card: ${designTokens.borderRadius.card}\n`;
  }

  if (designTokens && designTokens.shadows) {
    themeHints += `\nSHADOWS:\n`;
    if (designTokens.shadows.card) themeHints += `- Card Shadow: ${designTokens.shadows.card}\n`;
    if (designTokens.shadows.button) themeHints += `- Button Shadow: ${designTokens.shadows.button}\n`;
  }

  themeHints += '\n';

  if (theme && theme.componentStyleRules && !theme.componentStyleRules.includes('TODO')) {
    themeHints += `\nTHEME INSTRUCTION: You MUST preserve and strictly follow these '${theme.label}' design principles when repairing the component.
Design System Hints: ${theme.designSystemHints}
Component Rules: ${theme.componentStyleRules}
Typography Rules: Headings: ${theme.typographyHints?.headingStyle} | Body: ${theme.typographyHints?.bodyStyle}\n`;
  }

  const schema = (SectionDataSchemaRegistry as any)[targetComponent];
  let jsonSchemaStr = '';
  if (schema) {
    const fullJsonSchema = zodToJsonSchema(schema, targetComponent);
    const bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[targetComponent] : fullJsonSchema;
    jsonSchemaStr = `\nDATA PROP JSON SCHEMA (STRICT CONTRACT):\n${JSON.stringify(bareJsonSchema, null, 2)}\n`;
  }

  const issueContext = errorLog 
    ? `\nCOMPILER ERROR LOG:\n-------------------\n${errorLog}\n-------------------\n`
    : `\nQUALITY CONTROL CRITIQUE (Fix these missing/broken UI elements):\n-------------------\n${Array.isArray(critique) ? critique.map(c => '- ' + c).join('\n') : critique}\n-------------------\n`;

  return `
You are an expert React and Next.js developer acting as a code repair agent.
You previously generated the following component, but it failed our Quality Control or Compilation step.

SECTION TYPE: ${targetComponent}
${jsonSchemaStr}

BROKEN COMPONENT SOURCE CODE:
-------------------
${brokenCode}
-------------------
${issueContext}${themeHints}
YOUR TASK:
Fix the component so it satisfies all constraints and issues raised.
1. The component must still be named "${targetComponent}".
2. It must still accept the \`{ data }: any\` prop and strictly follow the JSON Schema. Do NOT invent new props.
3. If the critique mentions missing UI blocks (e.g. Map iframe, hours, buttons), you MUST implement them using Tailwind CSS.
4. CLIENT COMPONENT RULE: If you use hooks (useState, etc), add "use client"; at the top.
5. PAGESPEED/LIGHTHOUSE ISSUES: If the critique mentions PageSpeed issues, prioritize them to achieve a 100% score while maintaining a beautiful, human-friendly design.
   - For Global SEO issues (e.g. Meta tags, Title), fix them.
   - For Element-Level issues (e.g. missing alt text, contrast), cross-reference the failing HTML snippets provided. If your component generates that exact HTML, implement the fix. If not, IGNORE the issue.
6. Return ONLY the raw fixed .tsx code. No markdown fences, no explanations. Just the code.
`;
}
