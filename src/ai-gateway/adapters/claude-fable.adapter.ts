import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextAdapter } from '../interfaces/text-adapter.interface';
import { GenerateTextParams, TextChunk, Message } from '../interfaces/ai-gateway.types';

@Injectable()
export class ClaudeFableAdapter implements TextAdapter {
  private client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (
          attempt < maxRetries &&
          (error?.status === 429 || error?.status === 529 || error?.message?.includes('Overloaded'))
        ) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`[Claude Adapter] API Overloaded or Rate Limited. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unreachable');
  }

  async *generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk> {
    const stream = await this.executeWithRetry(() => this.client.messages.create({
      model,
      system: params.systemPrompt,
      messages: this.mapMessages(params.messages),
      max_tokens: params.maxTokens || 4096,
      stream: true,
    }));

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield { text: chunk.delta.text };
      }
    }
  }

  async generateText(model: string, params: GenerateTextParams) {
    const response = await this.executeWithRetry(() => this.client.messages.create({
      model,
      system: params.systemPrompt,
      messages: this.mapMessages(params.messages),
      max_tokens: params.maxTokens || 4096,
    }));

    const content = response.content[0];
    let text = '';
    if (content.type === 'text') {
      text = content.text;
    }

    return {
      text,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    };
  }

  private mapMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as any,
      }));
  }
}
