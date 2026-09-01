import { SSEEvent } from './interfaces/chat.types';
export declare class ChatStreamService {
    formatTokenEvent(text: string): SSEEvent;
    formatDoneEvent(): SSEEvent;
    formatErrorEvent(message: string): SSEEvent;
    formatFieldUpdateEvent(field: string, value: any): SSEEvent;
    formatSkillInvocationEvent(skillName: string, status: string): SSEEvent;
    formatInterviewProgressEvent(progress: number, missingFields: string[]): SSEEvent;
}
