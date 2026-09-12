import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { ChatStreamService } from './chat-stream.service';
import { Message } from '../ai-gateway/interfaces/ai-gateway.types';
import { SSEEvent } from './interfaces/chat.types';
import { SkillLoggerService } from '../skills/skill-logger.service';
import { AIModel } from '../common/constants/ai-models.constant';
import { AISkill } from '../common/constants/ai-skills.constant';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AIGatewayService,
    private readonly streamService: ChatStreamService,
    private readonly skillLogger: SkillLoggerService,
  ) {}

  async *sendMessage(projectId: string, content: string | any[], systemPrompt: string, model: string = AIModel.CLAUDE_HAIKU_4_5): AsyncIterable<SSEEvent | { event: 'internal-done'; data: { fullResponse: string } }> {
    // Extract text for DB persistence
    const textContent = Array.isArray(content) 
      ? content.find(c => c.type === 'text')?.text || '' 
      : content;

    // 1. Context is already persisted by chat-flow.engine.ts (or other callers)
    // We only need to fetch the context from the DB.
    
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

    // If the caller provided a system/injected prompt that is NOT yet in the DB,
    // or if we have multimodal content, we must append/replace it in memory.
    // However, if the exact textContent is already the last message (because chat-flow engine saved it),
    // we just replace its content with the multimodal version. 
    // If it's a completely new injected prompt (like a [SYSTEM: ...]), we push it.
    
    if (messages.length > 0 && messages[messages.length - 1].role === 'user' && messages[messages.length - 1].content === textContent) {
       messages[messages.length - 1].content = content;
    } else if (textContent) {
       messages.push({
         role: 'user',
         content: content
       });
    }

    // 3. Call AIGateway stream
    const stream = this.aiGateway.generateStream(model, {
      systemPrompt,
      messages,
    });

    let fullResponse = '';
    let usage: any;

    try {
      for await (const chunk of stream) {
        const text = chunk.text || '';
        fullResponse += text;
        if (chunk.usage) {
          usage = chunk.usage;
        }
        if (text) {
          yield this.streamService.formatTokenEvent(text);
        }
      }
    } catch (e: any) {
      yield this.streamService.formatErrorEvent(e.message);
      return;
    }

    const invocation = await this.skillLogger.logInvocation({
      projectId,
      skillType: AISkill.INTERVIEW,
      model,
      inputHash: 'stream-hash',
      status: 'success',
      tokens: usage?.promptTokens ? usage.promptTokens + usage.completionTokens : undefined,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      cost: usage?.cost,
      metadata: { phase: 'interview' },
    });

    // 4. Persist agent response
    await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: fullResponse,
        skillInvocationRef: invocation.id,
      },
    });

    yield { event: 'internal-done', data: { fullResponse } };
  }

  async getHistory(projectId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const messages = await this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    // Return in chronological order
    return messages.reverse();
  }
}
