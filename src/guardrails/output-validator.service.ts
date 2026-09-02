import { Injectable, Logger } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ComponentContract } from './component-contract';
import { CSSContract } from './css-contract';

@Injectable()
export class OutputValidatorService {
  private readonly logger = new Logger(OutputValidatorService.name);

  validate<T>(output: any, schema: ZodSchema<T>): T {
    try {
      let data = output;
      // In case the output is a JSON string, try parsing it first
      if (typeof output === 'string') {
        let cleanOutput = output.trim();
        // If it looks like it might have markdown, try to extract JSON
        if (!cleanOutput.startsWith('{') && !cleanOutput.startsWith('[')) {
          const match = cleanOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (match && match[1]) {
            cleanOutput = match[1].trim();
          } else {
            // Fallback: try to find the first { and last }
            const start = cleanOutput.indexOf('{');
            const end = cleanOutput.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
              cleanOutput = cleanOutput.substring(start, end + 1);
            }
          }
        }
        data = cleanOutput ? JSON.parse(cleanOutput) : {};
      }
      
      // 1. Structural Validation (Zod)
      const validated = schema.parse(data);

      // 2. Semantic Scope Validation
      this.deepValidateScope(validated);

      return validated;
    } catch (error) {
      if (error instanceof ZodError) {
        this.logger.error(`Validation failed: ${error.message}`);
        throw new Error(`Output validation failed: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      this.logger.error(`Failed to validate output. Raw text was: ${typeof output === "string" ? output : JSON.stringify(output)}\nError: ${(error as any)?.message}`);
      throw new Error(`Output is not valid: ${(error as any)?.message}`);
    }
  }

  private deepValidateScope(obj: any): void {
    if (typeof obj === 'string') {
      const refusalHeuristics = [
        /as an ai language model/i,
        /i am an ai/i,
        /i cannot fulfill/i,
        /i'm sorry, (but )?i cannot/i,
        /i don't have enough context/i,
        /against my programming/i,
      ];
      
      for (const regex of refusalHeuristics) {
        if (regex.test(obj)) {
          this.logger.error(`LLM Refusal detected in output string: "${obj}"`);
          throw new Error('LLM generated a refusal instead of valid scope content.');
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.deepValidateScope(item));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => this.deepValidateScope(value));
    }
  }

  validateKeywordPresence(title: string, h1: string, primaryKeyword: string): void {
    const titleLower = title.toLowerCase();
    const h1Lower = h1.toLowerCase();
    
    // Split the keyword into individual words (e.g. "general contractor peoria az" -> ["general", "contractor", "peoria", "az"])
    const keywordWords = primaryKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // Check if all words from the keyword exist somewhere in the title/h1
    const titleHasAllWords = keywordWords.every(word => titleLower.includes(word));
    const h1HasAllWords = keywordWords.every(word => h1Lower.includes(word));
    
    if (!titleHasAllWords) {
      throw new Error(`SEO Validation Failed: Title must contain primary keyword "${primaryKeyword}". Got: "${title}"`);
    }
    
    if (!h1HasAllWords) {
      throw new Error(`SEO Validation Failed: H1 must contain primary keyword "${primaryKeyword}". Got: "${h1}"`);
    }
  }

  validateComponentCode(code: string): void {
    // 1. Check forbidden patterns
    for (const pattern of ComponentContract.forbiddenPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Component Validation Failed: Found forbidden pattern: ${pattern.toString()}`);
      }
    }

    // 2. Check required patterns
    for (const pattern of ComponentContract.requiredPatterns) {
      if (!pattern.test(code)) {
        throw new Error(`Component Validation Failed: Missing required pattern: ${pattern.toString()}`);
      }
    }

    // 3. Extract imports and validate against whitelist
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (!ComponentContract.allowedImports.includes(importPath)) {
        throw new Error(`Component Validation Failed: Unauthorized import found: "${importPath}"`);
      }
    }
  }

  validateCSS(css: string): void {
    // 1. Check forbidden patterns
    for (const pattern of CSSContract.forbiddenClasses) {
      if (pattern.test(css)) {
        throw new Error(`CSS Validation Failed: Found forbidden class/pattern: ${pattern.toString()}`);
      }
    }

    // 2. Check for required breakpoints (very basic check)
    for (const bp of CSSContract.requiredBreakpoints) {
      // In Tailwind context, this just means the class exists in the string somewhere
      const bpPattern = new RegExp(`${bp}:`);
      if (!bpPattern.test(css)) {
         // It might be acceptable if the component is entirely flex/grid based, but the contract demands it for now.
         this.logger.warn(`CSS Validation Warning: Did not find responsive breakpoint: ${bp}:`);
      }
    }
  }

  groundCheckContent(content: any, businessContext: any): void {
    if (!businessContext) return;

    // Convert the entire content object to a single searchable lowercase string
    const contentStr = JSON.stringify(content).toLowerCase();

    // 1. Check Business Name
    if (businessContext.businessName) {
      // If the generated content contains placeholders or entirely different names, we flag it.
      // But for a simple heuristic: ensure the actual business name is mentioned at least once in the whole blob,
      // if it makes sense. Sometimes a small section might not have the name, so this is a soft check or 
      // depends on the section. For now, we'll check for obvious placeholder names.
      const placeholders = ['acme corp', 'your company', 'company name'];
      for (const ph of placeholders) {
        if (contentStr.includes(ph)) {
          throw new Error(`Grounding Validation Failed: Found placeholder business name "${ph}"`);
        }
      }
    }

    // 2. Check Location
    if (businessContext.location) {
      const locationPlaceholders = ['your city', 'city, state', 'your location'];
      for (const ph of locationPlaceholders) {
        if (contentStr.includes(ph)) {
           throw new Error(`Grounding Validation Failed: Found placeholder location "${ph}"`);
        }
      }
    }

    // 3. Phone/Email placeholders
    const contactPlaceholders = ['123-456-7890', '555-555', 'email@example.com', 'your@email.com'];
    for (const ph of contactPlaceholders) {
      if (contentStr.includes(ph)) {
        throw new Error(`Grounding Validation Failed: Found placeholder contact info "${ph}"`);
      }
    }
  }
}
