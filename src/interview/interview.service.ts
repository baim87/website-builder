import { Injectable } from '@nestjs/common';
import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { BusinessContextService } from '../projects/business-context.service';
import { GooglePlacesService } from '../projects/google-places.service';
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
    private readonly googlePlacesService: GooglePlacesService,
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
          const finalContext = await this.businessContextService.upsert(projectId, extractedFields);
          for (const [field, value] of Object.entries(extractedFields)) {
            yield { event: 'field-update', data: { field, value } };
          }
          
          // Auto-fetch cities if location and radius are provided, but no service areas
          if (finalContext.location && finalContext.radius) {
            const hasServiceAreas = finalContext.serviceAreas && Array.isArray(finalContext.serviceAreas) && finalContext.serviceAreas.length > 0;
            if (!hasServiceAreas) {
              const cities = await this.googlePlacesService.getCitiesInRadius(finalContext.location, finalContext.radius);
              if (cities.length > 0) {
                await this.prisma.businessContext.update({
                  where: { projectId },
                  data: { serviceAreas: cities }
                });
                yield { event: 'field-update', data: { field: 'serviceAreas', value: cities } };
              }
            }
          }
        }

        // Failsafe: if the AI outputted absolutely nothing (or just the extract block), ask manually
        const cleanResponse = fullResponse.replace(/<!-- EXTRACT:.*?-->/gs, '').trim();
        if (cleanResponse === '' && missingFields.length > 0) {
           const fallbackMsg = `Could you please tell me about your ${missingFields[0]}?`;
           yield { event: 'token', data: { token: fallbackMsg } };
           
           // IMPORTANT: We must save this fallback message to the database, otherwise the AI has no idea what the user's next answer means!
           await this.prisma.chatMessage.create({
             data: {
               projectId,
               role: 'assistant',
               content: fallbackMsg,
             }
           });
        }
        
        yield { event: 'done', data: {} };
      } else {
        yield event;
      }
    }
  }
}
