import { Controller, Post, Get, Param, Body, Sse, UseGuards, UsePipes, Query, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageSchema } from './dto/send-message.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import { ChatHistorySchema } from './dto/chat-history.dto';
import type { ChatHistoryDto } from './dto/chat-history.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

import { EditIntentService } from './edit-intent.service';
import { ProjectsService } from '../projects/projects.service';

import { ChatFlowEngine } from './chat-flow.engine';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,

    private readonly editIntentService: EditIntentService,
    private readonly projectsService: ProjectsService,
    private readonly chatFlowEngine: ChatFlowEngine,
  ) {}

  @Post(':projectId/message')
  @UsePipes(new ZodValidationPipe(SendMessageSchema))
  @Sse()
  sendMessage(
    @Param('projectId') projectId: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          const project = await this.projectsService.findOne(projectId, req.user.id);
          
          if (project.status === 'PUBLISHED' && project.websiteData) {
            // Edit Flow
            subscriber.next({ type: 'token', data: JSON.stringify({ token: "Let me take a look at that and apply the changes..." }) } as MessageEvent);
            
            // Add contextual message if targetBlock is present
            let contextMessage = dto.content;
            if (dto.targetBlock) {
               contextMessage = `User is specifically pointing at block: ${dto.targetBlock}. Message: ${dto.content}`;
            }

            const isEdit = await this.editIntentService.detectAndApplyEdit(projectId, req.user.id, contextMessage, project.websiteData);
            
            if (isEdit) {
                subscriber.next({ type: 'token', data: JSON.stringify({ token: "\n\nChanges have been made and the site is regenerating. Please wait a moment for the preview to update." }) } as MessageEvent);
            } else {
                subscriber.next({ type: 'token', data: JSON.stringify({ token: "\n\nI couldn't detect a specific website edit from your message. Could you be more specific?" }) } as MessageEvent);
            }
            subscriber.next({ type: 'done', data: {} } as MessageEvent);
          } else {
            // Onboarding Flow
            const stream = this.chatFlowEngine.processMessage(projectId, dto.content, dto.displayText);
            for await (const event of stream) {
              if (event.event === 'internal-done') {
                subscriber.next({ type: 'done', data: {} } as MessageEvent);
                break;
              } else {
                subscriber.next({ type: event.event, data: event.data } as MessageEvent);
              }
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
