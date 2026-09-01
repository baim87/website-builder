import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { BusinessContextService } from '../projects/business-context.service';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class InterviewService {
    private readonly extractor;
    private readonly promptBuilder;
    private readonly businessContextService;
    private readonly chatService;
    private readonly prisma;
    constructor(extractor: InterviewExtractorService, promptBuilder: InterviewPromptBuilder, businessContextService: BusinessContextService, chatService: ChatService, prisma: PrismaService);
    checkCompleteness(projectId: string, fieldsToCheck?: readonly string[]): Promise<{
        complete: boolean;
        missingFields: string[];
        progress: number;
    }>;
    processMessage(projectId: string, content: string, missingFields: string[]): AsyncGenerator<import("../chat/interfaces/chat.types").SSEEvent | {
        event: string;
        data: {
            field: string;
            value: any;
        };
    } | {
        event: string;
        data: {
            field?: undefined;
            value?: undefined;
        };
    }, void, unknown>;
}
