import { Injectable } from '@nestjs/common';
import { InterviewExtractorService } from './interview-extractor.service';
import { InterviewPromptBuilder } from './interview-prompt.builder';
import { BusinessContextService } from '../projects/business-context.service';
import { GooglePlacesService } from '../projects/google-places.service';
import { OnboardingStep, getFieldKeys, getFieldQuestion } from './constants/onboarding-flow.config';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import { parseRadiusToMiles } from '../utils/parse-radius.util';
import { ASSET_PURPOSE } from '../assets/constants/asset-purpose.constant';

export type InterviewEvent =
  | { event: 'field-update'; data: { field: string; value: any } }
  | { event: 'token'; data: { token: string } }
  | { event: 'progress'; data: { stepComplete: boolean; complete: boolean; missingFields: string[]; progress: number } }
  | { event: 'done'; data: {} };

@Injectable()
export class InterviewService {
  constructor(
    private readonly extractor: InterviewExtractorService,
    private readonly promptBuilder: InterviewPromptBuilder,
    private readonly businessContextService: BusinessContextService,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) { }

  async checkCompleteness(projectId: string, fieldsToCheck: readonly string[]) {
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

  async *processMessage(projectId: string, content: string, missingFields: string[], step: OnboardingStep, isEditing: boolean = false, lastAskedField?: string): AsyncGenerator<InterviewEvent, void, unknown> {
    const context = await this.businessContextService.findByProjectId(projectId);
    const systemPrompt = this.promptBuilder.buildPrompt(context, missingFields, step, lastAskedField);

    // Check for logo
    const logoAsset = await this.prisma.asset.findFirst({
      where: { projectId, purpose: ASSET_PURPOSE.LOGO },
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
        let cleanResponse = fullResponse.replace(/<!--\s*EXTRACT:\s*(?:```json)?\s*({.*?})\s*(?:```)?\s*-->/gs, '').trim();

        console.log(`\n======================================================\n` +
          `[AI Output]: ${cleanResponse}\n` +
          `[Extracted]: ${JSON.stringify(extractedFields)}\n` +
          `======================================================\n`);

        if (Object.keys(extractedFields).length > 0) {
          // Strictly enforce that AI cannot overwrite already filled fields outside of edit mode
          for (const key of Object.keys(extractedFields)) {
            const existingValue = context[key as keyof typeof context];
            const isAlreadyFilled = existingValue !== null && existingValue !== undefined && 
                                    (typeof existingValue === 'string' ? existingValue.trim() !== '' : true) && 
                                    (Array.isArray(existingValue) ? existingValue.length > 0 : true);
            
            if (!isEditing && isAlreadyFilled) {
              delete (extractedFields as any)[key];
              console.log(`[InterviewService] Ignored extracted field '${key}' because it is already filled and not in edit mode.`);
            }
          }

          if (Object.keys(extractedFields).length === 0) {
            // All fields were filtered out, nothing to update
            // Failsafe 1: empty response
            cleanResponse = fullResponse.replace(/<!--\s*EXTRACT:\s*(?:```json)?\s*({.*?})\s*(?:```)?\s*-->/gs, '').trim();

            // Re-evaluate completeness after updates
            const finalStatus = await this.checkCompleteness(projectId, getFieldKeys(step));

            if (finalStatus.missingFields.length > 0) {
              let fallbackMsg = '';

              if (cleanResponse === '') {
                const fallbackQ = getFieldQuestion(step, finalStatus.missingFields[0]) || `Could you please tell me about your ${finalStatus.missingFields[0]}?`;
                fallbackMsg = fallbackQ;
              } else if (!cleanResponse.includes('?')) {
                const fallbackQ = getFieldQuestion(step, finalStatus.missingFields[0]) || `Could you also tell me about your ${finalStatus.missingFields[0]}?`;
                fallbackMsg = `\n\n${fallbackQ}`;
              }

              if (fallbackMsg) {
                yield { event: 'token', data: { token: fallbackMsg } };

                try {
                  await this.prisma.chatMessage.create({
                    data: {
                      projectId,
                      role: 'assistant',
                      content: fallbackMsg,
                    }
                  });
                } catch (dbError: any) {
                  console.error(`Failed to save fallback chat message: ${dbError.message}`);
                }
              }
            }

            yield { event: 'progress', data: { ...finalStatus, stepComplete: finalStatus.complete } };
            yield { event: 'done', data: {} };
            continue;
          }

          const finalContext = await this.businessContextService.upsert(projectId, extractedFields);
          for (const [field, value] of Object.entries(extractedFields)) {
            yield { event: 'field-update', data: { field, value } };
          }

          // Auto-fetch cities if location and radius are provided, but no service areas
          if (finalContext.location && finalContext.radius) {
            const hasServiceAreas = finalContext.serviceAreas && Array.isArray(finalContext.serviceAreas) && finalContext.serviceAreas.length > 0;
            if (!hasServiceAreas) {
              const parsedRadius = parseRadiusToMiles(finalContext.radius);
              console.log(`[InterviewService] Fetching cities in a ${parsedRadius} mile radius from ${finalContext.location}...`);
              const cities = await this.googlePlacesService.getCitiesInRadius(finalContext.location, parsedRadius);
              console.log(`[InterviewService] Found ${cities.length} cities: ${cities.join(', ')}`);
              if (cities.length > 0) {
                await this.prisma.businessContext.update({
                  where: { projectId },
                  data: { serviceAreas: cities }
                });
                yield { event: 'field-update', data: { field: 'serviceAreas', value: cities } };

                const appendedText = `\n\nI've automatically mapped your service area to include: ${cities.join(', ')}.`;
                yield { event: 'token', data: { token: appendedText } };

                // Find the latest assistant message and append this text to persist it cleanly
                const latestMsg = await this.prisma.chatMessage.findFirst({
                  where: { projectId, role: 'assistant' },
                  orderBy: { createdAt: 'desc' }
                });
                if (latestMsg) {
                  // We remove the EXTRACT block from the saved message to keep the DB clean, 
                  // and we place the appended text after the clean response.
                  const cleanResponseText = latestMsg.content.replace(/<!-- EXTRACT:.*?-->/gs, '').trim();
                  await this.prisma.chatMessage.update({
                    where: { id: latestMsg.id },
                    data: { content: cleanResponseText + appendedText }
                  });
                }
              }
            }
          }
        }

        // Failsafe 1: empty response
        cleanResponse = fullResponse.replace(/<!-- EXTRACT:.*?-->/gs, '').trim();

        // Re-evaluate completeness after updates
        const finalStatus = await this.checkCompleteness(projectId, getFieldKeys(step));

        if (finalStatus.missingFields.length > 0) {
          let fallbackMsg = '';

          if (cleanResponse === '') {
            const fallbackQ = getFieldQuestion(step, finalStatus.missingFields[0]) || `Could you please tell me about your ${finalStatus.missingFields[0]}?`;
            fallbackMsg = fallbackQ;
          } else if (!cleanResponse.includes('?')) {
            const fallbackQ = getFieldQuestion(step, finalStatus.missingFields[0]) || `Could you also tell me about your ${finalStatus.missingFields[0]}?`;
            fallbackMsg = `\n\n${fallbackQ}`;
          }

          if (fallbackMsg) {
            yield { event: 'token', data: { token: fallbackMsg } };

            try {
              await this.prisma.chatMessage.create({
                data: {
                  projectId,
                  role: 'assistant',
                  content: fallbackMsg,
                }
              });
            } catch (dbError: any) {
              console.error(`Failed to save fallback chat message: ${dbError.message}`);
            }
          }
        }

        yield { event: 'progress', data: { ...finalStatus, stepComplete: finalStatus.complete } };

        yield { event: 'done', data: {} };
      } else {
        yield event as InterviewEvent;

      }
    }
  }
}
