import { GenerateTextParams, TextChunk } from './ai-gateway.types';

export interface TextAdapter {
  generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk>;
  generateText(model: string, params: GenerateTextParams): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number } }>;
}
