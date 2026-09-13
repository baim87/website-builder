import { SectionDataSchemaRegistry } from '../../schemas/section-data-contracts';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

export function buildComponentValidationPrompt(sectionType: string, componentCode: string): string | null {
  const schema = (SectionDataSchemaRegistry as any)[sectionType];
  if (!schema) {
    return null;
  }

  const fullJsonSchema = zodToJsonSchema(schema, sectionType);
  const bareJsonSchema = fullJsonSchema.definitions ? fullJsonSchema.definitions[sectionType] : fullJsonSchema;

  return `
You are a strict React and Next.js UI Validator.
Your task is to analyze the following React component source code and verify if it explicitly renders ALL the required data fields defined in its JSON schema contract.

SECTION TYPE: ${sectionType}
ZOD SCHEMA CONTRACT:
${JSON.stringify(bareJsonSchema, null, 2)}

REACT COMPONENT SOURCE CODE:
\`\`\`tsx
${componentCode}
\`\`\`

REQUIREMENTS:
1. The component receives a 'data' prop. You must ensure that the code actually renders the required fields from the schema (e.g. data.mapUrl, data.hours, data.phone) into the UI.
2. If the schema requires a Google Maps iframe (mapUrl) and the code doesn't have an iframe using data.mapUrl, that is a missing element.
3. If the code completely ignores rendering required text fields or contact info, that is a missing element.
4. Output a JSON object with 'isValid' (boolean) and 'missingElements' (array of strings describing exactly what is missing and how to fix it).

Return ONLY valid JSON.
{ "isValid": false, "missingElements": ["The iframe for data.mapUrl is completely missing.", "data.hours is not rendered anywhere."] }
`;
}
