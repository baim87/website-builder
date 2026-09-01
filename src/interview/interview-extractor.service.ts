import { Injectable, Logger } from '@nestjs/common';
import { ExtractedFields } from './interfaces/interview.types';

@Injectable()
export class InterviewExtractorService {
  private readonly logger = new Logger(InterviewExtractorService.name);

  extract(agentResponse: string): ExtractedFields {
    const regex = /<!--\s*EXTRACT:\s*({.*?})\s*-->/s;
    const match = agentResponse.match(regex);
    
    let extractedFields = {};
    let cleanResponse = agentResponse;

    if (match && match[1]) {
      try {
        extractedFields = JSON.parse(match[1]);
        cleanResponse = agentResponse.replace(regex, '').trim();
      } catch (e) {
        this.logger.error('Failed to parse JSON from extract block', e);
      }
    }

    return { cleanResponse, extractedFields };
  }
}
