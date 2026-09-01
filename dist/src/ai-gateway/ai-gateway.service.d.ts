import { GenerateTextParams, TextChunk } from './interfaces/ai-gateway.types';
import { ModelRegistry } from './config/model-registry';
import { AIGatewayLogger } from './ai-gateway.logger';
export declare class AIGatewayService {
    private readonly registry;
    private readonly logger;
    constructor(registry: ModelRegistry, logger: AIGatewayLogger);
    generateText(model: string, params: GenerateTextParams): Promise<{
        text: string;
        usage: {
            promptTokens: number;
            completionTokens: number;
        };
    }>;
    generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk>;
}
