import { ClaudeFableAdapter } from '../adapters/claude-fable.adapter';
import { TextAdapter } from '../interfaces/text-adapter.interface';
export declare class ModelRegistry {
    private readonly claudeAdapter;
    private registry;
    constructor(claudeAdapter: ClaudeFableAdapter);
    getAdapter(modelId: string): TextAdapter;
}
