import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextAdapter } from '../interfaces/text-adapter.interface';
import { GenerateTextParams, TextChunk } from '../interfaces/ai-gateway.types';

@Injectable()
export class OllamaCloudAdapter implements TextAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_CLOUD_BASE_URL', 'https://ollama.com');
    const key = this.configService.get<string>('OLLAMA_CLOUD_API_KEY');
    if (!key) {
      console.warn('[OllamaCloudAdapter] OLLAMA_CLOUD_API_KEY is missing from environment.');
    }
    this.apiKey = key || '';
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
          console.warn(`[Ollama Cloud] API Overloaded or Rate Limited. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unreachable');
  }

  private mapMessages(params: GenerateTextParams): any[] {
    const messages: any[] = [];
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    for (const msg of params.messages) {
      // If content is array (like images for Claude), map it to OpenAI format
      if (Array.isArray(msg.content)) {
        const mappedContent = msg.content.map(part => {
          if (part.type === 'text') return { type: 'text', text: part.text };
          if (part.type === 'image') return { 
            type: 'image_url', 
            image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` } 
          };
          return part;
        });
        messages.push({ role: msg.role, content: mappedContent });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    return messages;
  }

  async *generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk> {
    const ollamaModel = model.startsWith('claude-') ? 'kimi-k2.6:cloud' : model;
    const response = await this.executeWithRetry(() => fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: this.mapMessages(params),
        max_tokens: params.maxTokens || 4096,
        temperature: params.temperature ?? 0.7,
        stream: true,
      })
    }));

    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`Ollama Cloud API Error: ${response.statusText} - ${errorText}`);
      (err as any).status = response.status;
      throw err;
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Node 18+ Web Streams API
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the incomplete line in the buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices[0]?.delta?.content;
            if (delta) {
              yield { text: delta };
            }
          } catch (e) {
            console.error('[OllamaCloudAdapter] Error parsing stream chunk:', trimmed);
          }
        }
      }
    }
  }

  async generateText(model: string, params: GenerateTextParams): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number } }> {
    const ollamaModel = model.startsWith('claude-') ? 'kimi-k2.6:cloud' : model;
    const payload: any = {
      model: ollamaModel,
      messages: this.mapMessages(params),
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.7,
      stream: false,
    };

    if (params.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    }

    const response = await this.executeWithRetry(() => fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }));

    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`Ollama Cloud API Error: ${response.statusText} - ${errorText}`);
      (err as any).status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    const usage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    };

    return { text, usage };
  }
}
