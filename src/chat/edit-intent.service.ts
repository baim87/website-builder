import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { EditExecutorService } from './edit-executor.service';
import { OutputValidatorService } from '../guardrails/output-validator.service';
import { z } from 'zod';

const EditIntentSchema = z.object({
  isEdit: z.boolean(),
  changes: z.array(
    z.object({
      path: z.string(),
      value: z.any(),
    })
  ).optional(),
  triggerRegeneration: z.boolean().optional(),
});

@Injectable()
export class EditIntentService {
  private readonly logger = new Logger(EditIntentService.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly editExecutor: EditExecutorService,
    private readonly validator: OutputValidatorService,
  ) {}

  async detectAndApplyEdit(projectId: string, userMessage: string, currentWebsiteData: any): Promise<boolean> {
    const prompt = `You are a strict JSON-only intent detector for a website builder.
The user sent this message: "${userMessage}"
Current website data snippet: ${JSON.stringify(currentWebsiteData).substring(0, 1000)}...

If the user is asking to change the website (e.g. change color, update text, add a section), return JSON:
{
  "isEdit": true,
  "changes": [
    {
      "path": "designTokens.colors.primary",
      "value": "#ff0000"
    }
  ],
  "triggerRegeneration": true
}

If it's just a general question or unrelated, return {"isEdit": false}

Output ONLY valid JSON matching the schema.`;

    try {
      const response = await this.aiGateway.generateText('claude-fable', {
        systemPrompt: 'You extract edit intents in JSON format.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        responseFormat: 'json',
      });

      const intent = this.validator.validate(response.text, EditIntentSchema);

      if (intent.isEdit && intent.changes && intent.changes.length > 0) {
        this.logger.log(`Detected edit intent for project ${projectId}`, intent.changes);
        
        await this.editExecutor.applyEdits(projectId, intent, currentWebsiteData);
        
        return true;
      }
    } catch (e: any) {
      this.logger.error(`Failed to detect edit intent for project ${projectId}`, e.stack);
    }
    
    return false;
  }
}
