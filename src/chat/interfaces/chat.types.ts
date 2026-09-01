export type SSEEventType = 'token' | 'done' | 'error' | 'skill-invocation' | 'field-update' | 'interview-progress';

export interface SSEEvent {
  event: SSEEventType;
  data: any;
}
