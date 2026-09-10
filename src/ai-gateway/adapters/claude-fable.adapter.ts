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
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      baseURL: 'https://openrouter.ai/api',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Contractor Website Builder',
      }
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRateLimit = error?.status === 429 || error?.status === 529 || error?.message?.includes('Overloaded');
        const isInFlightLimit = error?.status === 402 && error?.message?.includes('in-flight requests');
        
        if (attempt < maxRetries && (isRateLimit || isInFlightLimit)) {
          let delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          
          if (isInFlightLimit) {
            // OpenRouter in-flight budget exhaustion usually requires a longer cooldown
            // Sometimes it gives Retry-After: 120 in headers, but we'll conservatively wait 30s per attempt
            delay = 30000 * attempt; 
            console.warn(`[Claude Adapter] OpenRouter in-flight limit reached (402). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
          } else {
            console.warn(`[Claude Adapter] API Overloaded or Rate Limited. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
          }
          
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unreachable');
  }

  async *generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk> {
    const openRouterModel = model;
    
    const stream = await this.executeWithRetry(() => this.client.messages.create({
      model: openRouterModel,
      system: params.systemPrompt,
      messages: this.mapMessages(params.messages),
      max_tokens: params.maxTokens || 4096,
      stream: true,
    }, {
      headers: params.maxTokens && params.maxTokens > 4096 ? { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' } : undefined
    }));

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield { text: chunk.delta.text };
      }
      
      // Attempt to catch OpenRouter usage injected in the stream
      const usageObj = (chunk as any).usage || (chunk as any).message?.usage;
      if (usageObj && (usageObj.prompt_tokens !== undefined || usageObj.input_tokens !== undefined)) {
        yield {
          text: '',
          usage: {
            promptTokens: usageObj.prompt_tokens ?? usageObj.input_tokens ?? 0,
            completionTokens: usageObj.completion_tokens ?? usageObj.output_tokens ?? 0,
            cost: usageObj.cost,
          }
        };
      }
    }
  }

  async generateText(model: string, params: GenerateTextParams) {
    const openRouterModel = model;
    
    let fullText = '';
    let currentMessages = this.mapMessages(params.messages);
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost: number | undefined = undefined;
    let keepGenerating = true;

    while (keepGenerating) {
      const requestParams: any = {
        model: openRouterModel,
        system: params.systemPrompt,
        messages: currentMessages,
        max_tokens: params.maxTokens || 4096,
      };
      
      if (params.schema) {
        requestParams.tools = [
          {
            name: params.schemaName || 'output_data',
            description: 'Output the structured data matching this schema.',
            input_schema: params.schema
          }
        ];
        requestParams.tool_choice = { type: 'tool', name: params.schemaName || 'output_data' };
      }

      const response = await this.executeWithRetry(() => this.client.messages.create(requestParams, {
        headers: params.maxTokens && params.maxTokens > 4096 ? { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' } : undefined
      }));

      let textChunk = '';
      let toolCall: any = null;
      if (params.schema && response.content) {
        toolCall = response.content.find((b: any) => b.type === 'tool_use');
      }

      if (toolCall) {
        fullText += JSON.stringify(toolCall.input);
        textChunk = JSON.stringify(toolCall.input);
      } else {
        if (params.schema) {
          console.warn('[Claude Adapter] Expected tool_use but not found! Content:', JSON.stringify(response.content));
        }
        for (const block of response.content) {
          if (block.type === 'text') {
            textChunk += block.text;
          } else {
            console.warn('[Claude Adapter] Ignoring non-text block:', block.type);
          }
        }
        fullText += textChunk;
      }
      const usageObj = (response as any).usage || {};
      totalPromptTokens += usageObj.prompt_tokens ?? response.usage.input_tokens;
      totalCompletionTokens += usageObj.completion_tokens ?? response.usage.output_tokens;
      if (usageObj.cost !== undefined) {
        totalCost = (totalCost || 0) + usageObj.cost;
      }

      if (response.stop_reason === 'max_tokens') {
        console.warn(`[Claude Adapter] Max tokens hit. Resuming generation...`);
        currentMessages.push({ role: 'assistant', content: textChunk });
        currentMessages.push({ role: 'user', content: 'Continue generating exactly where you left off, with no preamble or explanations.' });
      } else {
        keepGenerating = false;
      }
    }

    return {
      text: fullText,
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        cost: totalCost,
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
