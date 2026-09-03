import { Injectable } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';

export interface VisualCritique {
  scores: {
    visualHierarchy: number;
    colorConsistency: number;
    typography: number;
    spacing: number;
    mobileFriendliness: number;
    contractorRelevance: number;
  };
  issues: string[];
  overallScore: number;
}

@Injectable()
export class VisualQAService {
  constructor(private readonly aiService: AIGatewayService) {}

  /**
   * Send the base64 screenshot from PageSpeed API to an AI vision model.
   * The model evaluates UI/UX quality and returns a structured critique.
   */
  async critiqueScreenshot(
    screenshotBase64: string,
    pageUrl: string,
    businessType: string,
  ): Promise<VisualCritique> {
    const prompt = `
You are a senior UI/UX reviewer for contractor websites.
This is a screenshot of a ${businessType} website page: ${pageUrl}.

Evaluate the following and score each 1-10:
1. Visual hierarchy — Is the headline prominent? Is there a clear CTA?
2. Color consistency — Do the colors look cohesive and professional?
3. Typography — Are fonts readable and consistent?
4. Spacing — Is there proper whitespace and alignment?
5. Mobile friendliness — Does the layout look good at this viewport?
6. Contractor relevance — Does this look like a real contractor site (not SaaS)?
7. Empty/broken content — Any missing images, empty text, or placeholder content?

Return JSON: { "scores": { "visualHierarchy": 0, "colorConsistency": 0, "typography": 0, "spacing": 0, "mobileFriendliness": 0, "contractorRelevance": 0 }, "issues": [], "overallScore": 0 }
`;

    // Assuming aiService has generateText with multimodal support for base64 image strings
    const response = await this.aiService.generateText('gemini-2.5-pro', {
      systemPrompt: 'You output ONLY valid JSON. No markdown fences, no explanation, no commentary. Just the raw JSON object.',
      messages: [{ 
        role: 'user', 
        content: [
          { type: 'text', text: prompt },
          { 
            type: 'image', 
            source: { 
              type: 'base64', 
              media_type: 'image/jpeg', 
              data: screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '') 
            } 
          }
        ]
      }],
      temperature: 0.2,
      maxTokens: 2048,
      responseFormat: 'json',
    });

    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      return JSON.parse(raw) as VisualCritique;
    } catch {
      throw new Error(`Visual QA LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }
  }
}
