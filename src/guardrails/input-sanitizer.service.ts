import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class InputSanitizerService {
  private readonly promptInjectionHeuristics = [
    /ignore (all )?previous instructions/i,
    /system prompt/i,
    /you are now/i,
    /bypass/i,
    /jailbreak/i,
    /forget everything/i,
    /disregard/i,
    /do not follow/i,
    /from now on/i,
    /print your instructions/i,
    /what are your instructions/i,
    /^[\W_]+$/i, // Only punctuation/special chars
  ];

  private readonly piiHeuristics = [
    // SSN pattern
    /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,
    // Basic Credit Card pattern
    /\b(?:\d[ -]*?){13,16}\b/,
  ];

  sanitize(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // 1. Strip ALL HTML tags (chat inputs should be plain text)
    let clean = input.replace(/<[^>]*>?/gm, '');

    // 2. Check for Prompt Injection / Jailbreaks
    for (const regex of this.promptInjectionHeuristics) {
      if (regex.test(clean)) {
        throw new BadRequestException('Potentially unsafe prompt injection detected. Please rephrase.');
      }
    }

    // 3. Check for obvious PII (SSN, Credit Cards)
    for (const regex of this.piiHeuristics) {
      if (regex.test(clean)) {
        throw new BadRequestException('Sensitive information (PII) detected. Please do not share SSNs or Credit Card numbers.');
      }
    }

    // 4. Normalize excessive whitespace to prevent buffer stuffing
    clean = clean.replace(/\s{3,}/g, ' ').trim();

    return clean;
  }
}
