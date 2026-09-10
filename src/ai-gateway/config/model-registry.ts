import { Injectable } from '@nestjs/common';
import { ClaudeFableAdapter } from '../adapters/claude-fable.adapter';
// import { OllamaCloudAdapter } from '../adapters/ollama-cloud.adapter';
import { TextAdapter } from '../interfaces/text-adapter.interface';

@Injectable()
export class ModelRegistry {
  private registry = new Map<string, TextAdapter>();

  constructor(
    private readonly claudeAdapter: ClaudeFableAdapter,
    // private readonly ollamaAdapter: OllamaCloudAdapter,
  ) {
    this.registry.set('anthropic/claude-fable-5', this.claudeAdapter);
    this.registry.set('bytedance-seed/seedream-4.5', this.claudeAdapter);
    this.registry.set('bytedance-seed/seedream-5-0-pro', this.claudeAdapter);
    this.registry.set('anthropic/claude-haiku-4.5', this.claudeAdapter);
    // this.registry.set('kimi-k2.6:cloud', this.ollamaAdapter);
  }

  getAdapter(modelId: string): TextAdapter {
    const adapter = this.registry.get(modelId);
    if (!adapter) {
      throw new Error(`Unsupported model ID: ${modelId}`);
    }
    return adapter;
  }
}
