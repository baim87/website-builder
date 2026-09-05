import { Injectable } from '@nestjs/common';
// import { ClaudeFableAdapter } from '../adapters/claude-fable.adapter';
import { OllamaCloudAdapter } from '../adapters/ollama-cloud.adapter';
import { TextAdapter } from '../interfaces/text-adapter.interface';

@Injectable()
export class ModelRegistry {
  private registry = new Map<string, TextAdapter>();

  constructor(
    // TODO: Re-enable when Anthropic tokens are replenished
    // private readonly claudeAdapter: ClaudeFableAdapter,
    private readonly ollamaAdapter: OllamaCloudAdapter,
  ) {
    // TEMPORARY: Routing claude requests to ollamaAdapter per user request (Anthropic token depleted)
    this.registry.set('claude-fable-5', this.ollamaAdapter);
    this.registry.set('claude-haiku-4-5-20251001', this.ollamaAdapter);
    this.registry.set('kimi-k2.6:cloud', this.ollamaAdapter);
  }

  getAdapter(modelId: string): TextAdapter {
    const adapter = this.registry.get(modelId);
    if (!adapter) {
      throw new Error(`Unsupported model ID: ${modelId}`);
    }
    return adapter;
  }
}
