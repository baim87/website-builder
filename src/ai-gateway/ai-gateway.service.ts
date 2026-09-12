import { Injectable } from '@nestjs/common';
import { GenerateTextParams, TextChunk } from './interfaces/ai-gateway.types';
import { ModelRegistry } from './config/model-registry';
import { AIGatewayLogger } from './ai-gateway.logger';

@Injectable()
export class AIGatewayService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly logger: AIGatewayLogger,
  ) { }

  async generateText(model: string, params: GenerateTextParams) {
    const adapter = this.registry.getAdapter(model);
    const start = Date.now();
    try {
      const result = await adapter.generateText(model, params);
      const latency = Date.now() - start;
      this.logger.logCall(model, latency, result.usage);
      return result;
    } catch (e: any) {
      this.logger.logError(model, e);
      throw e;
    }
  }

  async *generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk> {
    const adapter = this.registry.getAdapter(model);
    const start = Date.now();
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost: number | undefined = undefined;

    try {
      const stream = adapter.generateStream(model, params);
      for await (const chunk of stream) {
        if (chunk.usage) {
          totalPromptTokens = chunk.usage.promptTokens || totalPromptTokens;
          totalCompletionTokens = chunk.usage.completionTokens || totalCompletionTokens;
          if (chunk.usage.cost !== undefined) {
            totalCost = chunk.usage.cost;
          }
        }
        yield chunk;
      }
      const latency = Date.now() - start;
      this.logger.logCall(model, latency, { 
        promptTokens: totalPromptTokens, 
        completionTokens: totalCompletionTokens,
        cost: totalCost 
      });
    } catch (e: any) {
      this.logger.logError(model, e);
      throw e;
    }
  }
}
