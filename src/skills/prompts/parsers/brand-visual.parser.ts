/**
 * Parses the raw LLM text response from BrandVisualSkill into a JSON object.
 * Handles markdown fences and JSON extraction from mixed content.
 */
export function parseBrandVisualResponse(raw: string): any {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else if (!text.startsWith('{') && text.includes('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      text = text.substring(start, end + 1);
    }
  }

  return JSON.parse(text);
}
