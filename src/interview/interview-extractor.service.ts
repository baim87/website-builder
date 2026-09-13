import { Injectable, Logger } from '@nestjs/common';
import { ExtractedFields } from './interfaces/interview.types';
import { UpdateBusinessContextSchema } from '../projects/dto/update-business-context.dto';

@Injectable()
export class InterviewExtractorService {
  private readonly logger = new Logger(InterviewExtractorService.name);

  extract(agentResponse: string): ExtractedFields {
    // This regex looks for JSON inside the EXTRACT block, optionally ignoring markdown backticks
    const regex = /<!--\s*EXTRACT:\s*(?:```json)?\s*({.*?})\s*(?:```)?\s*-->/gs;
    const matches = [...agentResponse.matchAll(regex)];
    
    let extractedFields = {};
    let cleanResponse = agentResponse;

    if (matches.length > 0) {
      for (const match of matches) {
        try {
          // LLMs sometimes add newlines in JSON output
          const parsed = JSON.parse(match[1]);

          // Enforce arrays for specific fields
          const arrayFields = ['services', 'hours', 'serviceAreas', 'competitors'];
          for (const field of arrayFields) {
            if (parsed[field] !== undefined && parsed[field] !== null && !Array.isArray(parsed[field])) {
               parsed[field] = typeof parsed[field] === 'string' ? [parsed[field]] : [];
            }
          }
          
          const validated = UpdateBusinessContextSchema.partial().safeParse(parsed);
          if (validated.success) {
            extractedFields = { ...extractedFields, ...validated.data };
          } else {
            this.logger.warn(`Zod validation failed for extracted fields: ${validated.error.message}`);
          }
        } catch (e) {
          this.logger.error('Failed to parse JSON from extract block', e);
        }
      }
      cleanResponse = agentResponse.replace(regex, '').trim();
    }

    return { cleanResponse, extractedFields };
  }
}
