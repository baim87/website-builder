import { Controller, Post, Get, Param, Body, Sse, UseGuards, UsePipes, Query } from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageSchema } from './dto/send-message.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import { ChatHistorySchema } from './dto/chat-history.dto';
import type { ChatHistoryDto } from './dto/chat-history.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { InterviewService } from '../interview/interview.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly interviewService: InterviewService,
  ) {}

  @Post(':projectId/message')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  @Sse()
  sendMessage(
    @Param('projectId') projectId: string,
    @Body() dto: SendMessageDto,
  ): Observable<MessageEvent> {
    // We convert the AsyncIterable to an Observable
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          const status = await this.interviewService.checkCompleteness(projectId);
          const stream = this.interviewService.processMessage(projectId, dto.content, status.missingFields);
          for await (const event of stream) {
            if (event.event === 'internal-done') {
              subscriber.next({ type: 'done', data: {} } as MessageEvent);
              break;
            } else {
              subscriber.next({ type: event.event, data: event.data } as MessageEvent);
            }
          }
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  @Get(':projectId/history')
  getHistory(
    @Param('projectId') projectId: any,
    @Query(new ZodValidationPipe(ChatHistorySchema)) query: ChatHistoryDto,
  ) {
    return this.chatService.getHistory(projectId, query.page, query.limit);
  }
}
