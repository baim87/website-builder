import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { ChatStreamService } from './chat-stream.service';
import { SSEEvent } from './interfaces/chat.types';
export declare class ChatService {
    private readonly prisma;
    private readonly aiGateway;
    private readonly streamService;
    constructor(prisma: PrismaService, aiGateway: AIGatewayService, streamService: ChatStreamService);
    sendMessage(projectId: string, content: string | any[], systemPrompt: string, model?: string): AsyncIterable<SSEEvent | {
        event: 'internal-done';
        data: {
            fullResponse: string;
        };
    }>;
    getHistory(projectId: string, page: number, limit: number): Promise<{
        id: string;
        projectId: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        role: string;
        voiceTranscript: boolean;
        skillInvocationRef: string | null;
    }[]>;
}
