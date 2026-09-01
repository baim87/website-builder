import { ExtractedFields } from './interfaces/interview.types';
export declare class InterviewExtractorService {
    private readonly logger;
    extract(agentResponse: string): ExtractedFields;
}
