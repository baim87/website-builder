import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AIModel } from '../common/constants/ai-models.constant';

@Injectable()
export class ImageCritiqueService {
  private readonly logger = new Logger(ImageCritiqueService.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  /**
   * Critiques a generated image using Seedream 5.0 Pro to ensure it matches
   * the prompt and doesn't contain obvious AI hallucinations.
   */
  async critiqueImage(buffer: Buffer, originalPrompt: string, progressTag: string = ''): Promise<{ isValid: boolean; critique: string; suggestedNewPrompt: string }> {
    this.logger.log(`${progressTag} Critiquing generated image...`);
    
    const critiquePrompt = `Analyze this AI-generated image created from the prompt: "${originalPrompt}"
Check for:
1. Obvious AI hallucinations (e.g., extra limbs, fused objects, garbled text).
2. Poor quality, extreme blur, or weird proportions.
3. Completely failing to match the prompt context.

Return JSON EXACTLY in this format:
{
  "isValid": true/false,
  "critique": "Detailed reason why it failed, or empty if it passed",
  "suggestedNewPrompt": "If it failed, provide a strictly improved prompt that avoids the hallucination/issue"
}`;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You output ONLY valid JSON.',
        messages: [{ 
          role: 'user', 
          content: [
            { type: 'text', text: critiquePrompt },
            { 
              type: 'image', 
              source: { 
                type: 'base64', 
                media_type: 'image/jpeg', 
                data: buffer.toString('base64') 
              } 
            }
          ]
        }],
        temperature: 0.2,
        responseFormat: 'json',
      });
      
      const parsed = JSON.parse(response.text.trim().replace(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i, '$1'));
      return {
        isValid: !!parsed.isValid,
        critique: parsed.critique || '',
        suggestedNewPrompt: parsed.suggestedNewPrompt || originalPrompt
      };
    } catch (err) {
      this.logger.warn(`${progressTag} Critique failed to parse, accepting image anyway. Error: ${err.message}`);
      // If the critique itself fails (e.g. rate limit, unparseable), we assume it's valid to avoid blocking generation
      return { isValid: true, critique: '', suggestedNewPrompt: originalPrompt };
    }
  }
}
