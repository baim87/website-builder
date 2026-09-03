import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { ChatStreamService } from './chat-stream.service';
import { Message } from '../ai-gateway/interfaces/ai-gateway.types';
import { SSEEvent } from './interfaces/chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AIGatewayService,
    private readonly streamService: ChatStreamService,
  ) {}

  async *sendMessage(projectId: string, content: string | any[], systemPrompt: string, model: string = 'claude-haiku-4-5-20251001'): AsyncIterable<SSEEvent | { event: 'internal-done'; data: { fullResponse: string } }> {
    // Extract text for DB persistence
    const textContent = Array.isArray(content) 
      ? content.find(c => c.type === 'text')?.text || '' 
      : content;

    // 1. Persist user message (text only)
    await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: 'user',
        content: textContent,
      },
    });

    // 2. Build context
    const historyDesc = await this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20, // last 20 messages
    });
    const history = historyDesc.reverse();

    const messages: Message[] = history.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    // Replace the last message's content with the full multimodal content for this turn
    if (messages.length > 0 && Array.isArray(content)) {
      messages[messages.length - 1].content = content;
    }

    // 3. Call AIGateway stream
    const stream = this.aiGateway.generateStream(model, {
      systemPrompt,
      messages,
    });

    let fullResponse = '';

    try {
      for await (const chunk of stream) {
        const text = chunk.text || '';
        fullResponse += text;
        yield this.streamService.formatTokenEvent(text);
      }
    } catch (e: any) {
      yield this.streamService.formatErrorEvent(e.message);
      return;
    }

    // 4. Persist agent response
    await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: fullResponse,
      },
    });

    yield { event: 'internal-done', data: { fullResponse } };
  }

  async getHistory(projectId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });
  }
}
