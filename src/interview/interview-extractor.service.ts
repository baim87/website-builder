import { Injectable, Logger } from '@nestjs/common';
import { ExtractedFields } from './interfaces/interview.types';

@Injectable()
export class InterviewExtractorService {
  private readonly logger = new Logger(InterviewExtractorService.name);

  extract(agentResponse: string): ExtractedFields {
    const regex = /<!--\s*EXTRACT:\s*({.*?})\s*-->/gs;
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
          
          extractedFields = { ...extractedFields, ...parsed };
        } catch (e) {
          this.logger.error('Failed to parse JSON from extract block', e);
        }
      }
      cleanResponse = agentResponse.replace(regex, '').trim();
    }

    return { cleanResponse, extractedFields };
  }
}
