import { ConfigService } from '@nestjs/config';
import { TextAdapter } from '../interfaces/text-adapter.interface';
import { GenerateTextParams, TextChunk } from '../interfaces/ai-gateway.types';
export declare class ClaudeFableAdapter implements TextAdapter {
    private readonly configService;
    private client;
    constructor(configService: ConfigService);
    private executeWithRetry;
    generateStream(model: string, params: GenerateTextParams): AsyncIterable<TextChunk>;
    generateText(model: string, params: GenerateTextParams): Promise<{
        text: string;
        usage: {
            promptTokens: number;
            completionTokens: number;
        };
    }>;
    private mapMessages;
}
