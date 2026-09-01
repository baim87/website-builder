export interface InterviewState {
  complete: boolean;
  missingFields: string[];
  progress: number;
}

export interface ExtractedFields {
  cleanResponse: string;
  extractedFields: Record<string, any>;
}
