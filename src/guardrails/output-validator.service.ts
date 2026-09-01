import { Injectable, Logger } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

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
}
