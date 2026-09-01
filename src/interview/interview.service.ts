import { Injectable } from '@nestjs/common';
import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { BusinessContextService } from '../projects/business-context.service';
import { REQUIRED_FIELDS } from './constants/interview-fields.constant';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';

@Injectable()
export class InterviewService {
  constructor(
    private readonly extractor: InterviewExtractorService,
    private readonly promptBuilder: InterviewPromptBuilder,
    private readonly businessContextService: BusinessContextService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  async checkCompleteness(projectId: string, fieldsToCheck: readonly string[] = REQUIRED_FIELDS) {
    const context = await this.businessContextService.findByProjectId(projectId);
    const missingFields = [];

    for (const field of fieldsToCheck) {
      const val = context[field as keyof typeof context];
      if (!val || (Array.isArray(val) && val.length === 0)) {
        missingFields.push(field);
      }
    }

    const total = fieldsToCheck.length;
    const completeCount = total - missingFields.length;
    
    return {
      complete: missingFields.length === 0,
      missingFields,
      progress: Math.round((completeCount / total) * 100),
    };
  }
  
  async *processMessage(projectId: string, content: string, missingFields: string[]) {
    const context = await this.businessContextService.findByProjectId(projectId);
    const systemPrompt = this.promptBuilder.buildPrompt(context, missingFields);
    
    // Check for logo
    const logoAsset = await this.prisma.asset.findFirst({
      where: { projectId, purpose: 'logo' },
      orderBy: { createdAt: 'desc' }
    });

    let finalContent: any = content;
    
    if (logoAsset && missingFields.includes('primaryColor')) {
      try {
        let base64 = '';
        let mimeType = logoAsset.mimeType || 'image/png';
        
        if (logoAsset.url.startsWith('http')) {
          const res = await fetch(logoAsset.url);
          const buffer = await res.arrayBuffer();
          base64 = Buffer.from(buffer).toString('base64');
          mimeType = res.headers.get('content-type') || mimeType;
        } else {
          base64 = fs.readFileSync(logoAsset.url, 'base64');
        }

        finalContent = [
          { type: 'text', text: content },
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
        ];
      } catch (err) {
        // Ignore logo error if we can't read it
      }
    }

    const stream = this.chatService.sendMessage(projectId, finalContent, systemPrompt);
    
    for await (const event of stream) {
      if (event.event === 'internal-done') {
        const fullResponse = event.data.fullResponse;
        const { extractedFields } = this.extractor.extract(fullResponse);
        
        if (Object.keys(extractedFields).length > 0) {
          await this.businessContextService.upsert(projectId, extractedFields);
          // Yield an event to notify client of updated fields
          for (const [field, value] of Object.entries(extractedFields)) {
            yield { event: 'field-update', data: { field, value } };
          }
        }
        
        yield { event: 'done', data: {} };
      } else {
        yield event;
      }
    }
  }
}
