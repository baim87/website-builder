import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';

export interface VisualCritiqueIssue {
  description: string;
  issueType: 'CODE' | 'ASSET' | 'COPYWRITING' | 'BRAND';
  imageUrl?: string;
  brandName?: string;
}

export interface VisualCritique {
  pageUrl: string;
  strategy: 'mobile' | 'desktop';
  scores: {
    visualHierarchy: number;
    colorConsistency: number;
    typography: number;
    spacing: number;
    mobileFriendliness: number;
    contractorRelevance: number;
  };
  issues: { componentName: string; issues: VisualCritiqueIssue[] }[];
  overallScore: number;
}

@Injectable()
export class VisualQAService {
  private readonly logger = new Logger(VisualQAService.name);

  constructor(private readonly aiService: AIGatewayService) {}

  /**
   * Send the base64 screenshot from PageSpeed API to an AI vision model.
   * The model evaluates UI/UX quality and returns a structured critique.
   */
  async critiqueScreenshot(
    screenshotBase64: string,
    pageUrl: string,
    businessType: string,
    componentsOnPage: string[],
    strategy: 'mobile' | 'desktop'
  ): Promise<VisualCritique> {
    this.logger.log(`Analyzing visual design with AI Vision for ${pageUrl} (${strategy})...`);
    
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
8. Image Quality & Context — Look closely at all photographs on the page. Do any of them look like low-quality AI generations with obvious visual hallucinations (e.g., garbled text on signs, anatomical errors, weird proportions)? Does the image logically match the surrounding text context (e.g., an "Our Team" section should not show a roof)?

This page is composed of the following React components and underlying JSON data:
${componentsOnPage.join('\n')}

For any visual flaws or issues you find, you MUST map them to the specific component responsible for that part of the screen.
For each issue, you MUST specify the issueType:
- Use 'CODE' for layout, spacing, typography alignment, broken links, missing UI elements, or styling bugs (e.g. overlapping text, fixed headers covering content).
- Use 'ASSET' ONLY if a specific AI-generated image photograph is ugly, hallucinated, or contextually irrelevant. If 'ASSET', you MUST provide the EXACT 'imageUrl' (e.g. "https://...") found in the JSON data for that component. Do NOT return a description. If you cannot find the exact URL in the JSON data, fall back to describing it but prepend it with "DESC: ".
- Use 'COPYWRITING' if text is generic, uses SaaS terminology, is misspelled, has placeholder "lorem ipsum", or doesn't match the brand tone.
- Use 'BRAND' if a partner logo (e.g., BBB, GAF, Trex) or brand asset is broken, hallucinated, or incorrect. If 'BRAND', you MUST provide the 'brandName' that is broken.

Return a JSON object EXACTLY in this format:
{
  "scores": {
    "visualHierarchy": 8,
    "colorConsistency": 9,
    "typography": 7,
    "spacing": 8,
    "mobileFriendliness": 9,
    "contractorRelevance": 9
  },
  "componentResults": [
    {
      "componentName": "HeroSection",
      "status": "pass",
      "issues": []
    },
    {
      "componentName": "FooterSection",
      "status": "fail",
      "issues": [
        {
          "description": "Text contrast is too low",
          "issueType": "CODE"
        }
      ]
    },
    {
      "componentName": "AboutSection",
      "status": "fail",
      "issues": [
        {
          "description": "Image shows a person with 6 fingers",
          "issueType": "ASSET",
          "imageUrl": "https://pub-...r2.dev/assets/..."
        }
      ]
    },
    {
      "componentName": "BrandsSection",
      "status": "fail",
      "issues": [
        {
          "description": "The BBB logo is hallucinated and misspelled",
          "issueType": "BRAND",
          "brandName": "Better Business Bureau"
        }
      ]
    }
  ],
  "overallScore": 8.5
}
Ensure every component in the componentsOnPage list is evaluated in the componentResults array.
`;

    // Assuming aiService has generateText with multimodal support for base64 image strings
    const response = await this.aiService.generateText('anthropic/claude-fable-5', {
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
      maxTokens: 8192,
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
      const parsed = JSON.parse(raw) as any;

      const componentResults = parsed.componentResults || [];
      const issues = [];

      for (const comp of componentResults) {
        if (comp.status === 'pass') {
          this.logger.log(`audit section: ${comp.componentName} page: ${pageUrl} for ${strategy}, Result: Pass Audit`);
        } else {
          this.logger.log(`audit section: ${comp.componentName} page: ${pageUrl} for ${strategy}, Result: Fail (${comp.issues?.map((i: any) => i.description).join(', ') || 'Unknown'})`);
          issues.push({ componentName: comp.componentName, issues: comp.issues || [] });
        }
      }

      return {
        scores: parsed.scores,
        overallScore: parsed.overallScore,
        issues,
        pageUrl,
        strategy,
      };
    } catch {
      throw new Error(`Visual QA LLM returned unparseable output: ${response.text.substring(0, 200)}`);
    }
  }
}
