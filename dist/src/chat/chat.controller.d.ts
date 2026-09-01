import { ChatService } from './chat.service';
import type { SendMessageDto } from './dto/send-message.dto';
import type { ChatHistoryDto } from './dto/chat-history.dto';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { InterviewService } from '../interview/interview.service';
export declare class ChatController {
    private readonly chatService;
    private readonly interviewService;
    constructor(chatService: ChatService, interviewService: InterviewService);
    sendMessage(projectId: string, dto: SendMessageDto): Observable<MessageEvent>;
    getHistory(projectId: any, query: ChatHistoryDto): Promise<{
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
