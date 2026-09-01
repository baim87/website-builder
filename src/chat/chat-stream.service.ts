import { Injectable } from '@nestjs/common';
import { SSEEvent } from './interfaces/chat.types';

@Injectable()
export class ChatStreamService {
  formatTokenEvent(text: string): SSEEvent {
    return { event: 'token', data: { token: text } };
  }

  formatDoneEvent(): SSEEvent {
    return { event: 'done', data: {} };
  }

  formatErrorEvent(message: string): SSEEvent {
    return { event: 'error', data: { message } };
  }
  
  formatFieldUpdateEvent(field: string, value: any): SSEEvent {
    return { event: 'field-update', data: { field, value } };
  }

  formatSkillInvocationEvent(skillName: string, status: string): SSEEvent {
    return { event: 'skill-invocation', data: { skillName, status } };
  }

  formatInterviewProgressEvent(progress: number, missingFields: string[]): SSEEvent {
    return { event: 'interview-progress', data: { progress, missingFields } };
  }
}
