/**
 * Centralized utility for parsing LLM outputs.
 * Enforces DRY and SSOT for stripping markdown fences and extracting structured data.
 */
import { Logger } from '@nestjs/common';

const logger = new Logger('LlmParser');

/**
 * Extracts JSON from a raw LLM text response.
 * Handles markdown fences (e.g., ```json ... ```) and leading/trailing text.
 * @param raw The raw text output from the LLM
 * @returns The parsed JSON object
 * @throws Error if the JSON cannot be parsed
 */
export function parseJsonFromLlm(raw: string): any {
  let text = raw.trim();

  // Strip markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else if (!text.startsWith('{') && text.includes('{')) {
    // Attempt to extract the first { to the last }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      text = text.substring(start, end + 1);
    }
  } else if (!text.startsWith('{') && !text.startsWith('[') && text.includes('[')) {
     // Attempt to extract the first [ to the last ] for array root
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end > start) {
      text = text.substring(start, end + 1);
    }
  }

  // Attempt to sanitize unescaped newlines within strings if necessary
  // A simple heuristic is to try parsing, and if it fails due to newlines, we can try to escape them.
  try {
    return JSON.parse(text);
  } catch (e: any) {
    // Basic attempt to fix unescaped newlines in JSON strings (common LLM hallucination)
    const sanitized = text.replace(/(?<=:\s*"(?:[^"\\]|\\.)*)(?<!\\)\n(?=(?:[^"\\]|\\.)*")/g, '\\n');
    try {
      return JSON.parse(sanitized);
    } catch (e2: any) {
      require('fs').writeFileSync('/tmp/raw-json-debug.txt', raw);
      require('fs').writeFileSync('/tmp/invalid-json-debug.txt', text);
      logger.error(`Failed to parse JSON. Error: ${e.message}. Raw snippet: ${raw.substring(0, 200)}... (Full text saved to /tmp/invalid-json-debug.txt)`);
      throw new Error('Invalid JSON received from LLM');
    }
  }
}

/**
 * Extracts raw markdown content from an LLM response.
 * Strips outer ```markdown fences if the model aggressively wrapped the entire response.
 * @param raw The raw text output from the LLM
 * @returns The clean markdown string
 */
export function parseMarkdownFromLlm(raw: string): string {
  let text = raw.trim();
  
  if (text.startsWith('```markdown')) {
    text = text.replace(/^```markdown\n/, '').replace(/\n```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  return text.trim();
}

/**
 * Extracts raw CSS content from an LLM response.
 * Strips outer ```css fences.
 * @param raw The raw text output from the LLM
 * @returns The clean CSS string
 */
export function parseCssFromLlm(raw: string): string {
  let css = raw.trim();
  const cssFenceMatch = css.match(/```(?:css)?\s*([\s\S]*?)\s*```/i);
  if (cssFenceMatch) {
    css = cssFenceMatch[1].trim();
  } else if (css.startsWith('```')) {
    css = css.replace(/^```\n/, '').replace(/\n```$/, '');
  }
  return css.trim();
}
