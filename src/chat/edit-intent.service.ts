import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { EditExecutorService } from './edit-executor.service';
import { OutputValidatorService } from '../guardrails/output-validator.service';
import { z } from 'zod';
import { AIModel } from '../common/constants/ai-models.constant';

const EditIntentSchema = z.object({
  isEdit: z.boolean(),
  action: z.enum(['EDIT_GLOBAL', 'STORE_GALLERY', 'REPLACE_IMAGE_CLARIFY', 'NONE']).optional(),
  changes: z.array(
    z.object({
      path: z.string(),
      value: z.any(),
    })
  ).optional(),
  triggerRegeneration: z.boolean().optional(),
  clarificationMessage: z.string().optional(),
});

@Injectable()
export class EditIntentService {
  private readonly logger = new Logger(EditIntentService.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly editExecutor: EditExecutorService,
    private readonly validator: OutputValidatorService,
  ) {}

  async detectAndApplyEdit(projectId: string, userId: string, userMessage: string, currentWebsiteData: any): Promise<{isEdit: boolean, intent?: any}> {
const prompt = `You are a strict JSON-only intent detector for a website builder.
The user sent this message: "${userMessage}"
Current website data snippet: ${JSON.stringify(currentWebsiteData).substring(0, 1000)}...

1. GLOBAL EDIT: If the user is asking to change GLOBAL website settings (e.g. change color, update SEO, update designTokens), return JSON:
{
  "isEdit": true,
  "action": "EDIT_GLOBAL",
  "changes": [
    {
      "path": "designTokens.colors.primary",
      "value": "#ff0000"
    }
  ],
  "triggerRegeneration": true
}

2. STORE IN GALLERY: If the user attached an asset (e.g., "[Attached Asset: ...]") and explicitly asks to store it in the gallery, return:
{
  "isEdit": true,
  "action": "STORE_GALLERY"
}

3. CLARIFY REPLACE IMAGE: If the user attached an asset and asks to replace an image but did NOT select a specific target block (or if the intent is ambiguous), return:
{
  "isEdit": true,
  "action": "REPLACE_IMAGE_CLARIFY",
  "clarificationMessage": "Which image would you like to replace? Please click on the specific image in the preview first, then try again."
}

CRITICAL: Do NOT return changes for specific page content or sections (e.g. hero, about, subtitle). This service ONLY handles global settings or the specific asset intents above.
If the user is asking to change page content without an asset, or if it's just a general question or unrelated, return {"isEdit": false, "action": "NONE"}

Output ONLY valid JSON matching the schema.`;

    try {
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You extract edit intents in JSON format.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        responseFormat: 'json',
      });

      const intent = this.validator.validate(response.text, EditIntentSchema);

      if (intent.isEdit && intent.changes && intent.changes.length > 0) {
        this.logger.log(`Detected edit intent for project ${projectId}`, intent.changes);
        
        await this.editExecutor.applyEdits(projectId, userId, intent, currentWebsiteData);
        
        return { isEdit: true, intent };
      }
    } catch (e: any) {
      this.logger.error(`Failed to detect edit intent for project ${projectId}`, e.stack);
    }
    
    return { isEdit: false };
  }
}
