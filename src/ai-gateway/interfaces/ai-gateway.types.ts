export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string | Array<{ type: 'text', text: string } | { type: 'image', source: { type: 'base64', media_type: string, data: string } }>;
}

export interface TextChunk {
  text: string;
}

export interface GenerateTextParams {
  systemPrompt?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}
