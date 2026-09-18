import { Injectable } from '@nestjs/common';
import { ClaudeFableAdapter } from '../adapters/claude-fable.adapter';
// import { OllamaCloudAdapter } from '../adapters/ollama-cloud.adapter';
import { TextAdapter } from '../interfaces/text-adapter.interface';
import { AIModel } from '../../common/constants/ai-models.constant';

@Injectable()
export class ModelRegistry {
  private registry = new Map<string, TextAdapter>();

  constructor(
    private readonly claudeAdapter: ClaudeFableAdapter,
    // private readonly ollamaAdapter: OllamaCloudAdapter,
  ) {
    this.registry.set(AIModel.CLAUDE_FABLE_5, this.claudeAdapter);
    this.registry.set(AIModel.SEEDREAM_4_5, this.claudeAdapter);
    this.registry.set(AIModel.SEEDREAM_5_0_PRO, this.claudeAdapter);
    this.registry.set(AIModel.CLAUDE_HAIKU_4_5, this.claudeAdapter);
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
