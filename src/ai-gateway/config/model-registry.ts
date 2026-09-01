import { Injectable } from '@nestjs/common';
import { ClaudeFableAdapter } from '../adapters/claude-fable.adapter';
import { TextAdapter } from '../interfaces/text-adapter.interface';

@Injectable()
export class ModelRegistry {
  private registry = new Map<string, TextAdapter>();

  constructor(
    private readonly claudeAdapter: ClaudeFableAdapter,
  ) {
    // Single source of truth for model-to-adapter mapping
    this.registry.set('claude-fable-5', this.claudeAdapter);
    this.registry.set('claude-haiku-4-5-20251001', this.claudeAdapter);
  }

  getAdapter(modelId: string): TextAdapter {
    const adapter = this.registry.get(modelId);
    if (!adapter) {
      throw new Error(`Unsupported model ID: ${modelId}`);
    }
    return adapter;
  }
}
