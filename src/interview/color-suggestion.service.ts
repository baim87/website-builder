import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AIModel } from '../common/constants/ai-models.constant';

export interface ColorPalette {
  name: string;
  colors: string[];
}

@Injectable()
export class ColorSuggestionService {
  private readonly logger = new Logger(ColorSuggestionService.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async generateColorPalettes(trade: string, location: string, vibe: string): Promise<ColorPalette[]> {
    const prompt = `
      You are an expert brand designer for the United States local service trades.
      The user is a contractor in the "${trade}" trade, operating in "${location}".
      Their brand vibe is described as: "${vibe}".
      
      Generate 4 distinct, premium color palettes (each containing exactly 2 hex codes: a primary and a secondary color) that perfectly match this business.
      Make sure the names of the palettes are descriptive and catchy, e.g. "Ocean & Sand" or "Industrial Steel & Amber".
      
      You MUST return ONLY a valid JSON object in this EXACT format:
      {
        "palettes": [
          {
            "name": "Ocean & Sand",
            "colors": ["#162231", "#D4AF37"]
          }
        ]
      }
      Do not output any markdown formatting, explanations, or extra text.
    `;

    try {
      this.logger.log(`Generating color palettes for trade: ${trade}, location: ${location}, vibe: ${vibe}`);
      const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
        systemPrompt: 'You are a helpful assistant. Always output a clean JSON array.',
        messages: [{ role: 'user', content: prompt }],
        schema: {
          type: 'object',
          properties: {
            palettes: {
              type: 'array',
              items: { 
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'A catchy name for this palette, e.g. "Ocean & Sand"' },
                  colors: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Exactly 2 hex codes.'
                  }
                },
                required: ['name', 'colors']
              }
            }
          },
          required: ['palettes']
        },
        schemaName: 'ColorPalettes'
      });
      
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      
      let parsed = JSON.parse(raw);
      
      // If it returned { palettes: [...] } because of our schema
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.palettes)) {
        parsed = parsed.palettes;
      }
      
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const values = Object.values(parsed);
        const arrayVal = values.find(v => Array.isArray(v));
        if (arrayVal) {
          parsed = arrayVal;
        }
      }

      if (!Array.isArray(parsed)) {
         return this.getDefaultPalettes();
      }

      return parsed.map((p: any) => ({
        name: p.name,
        colors: Array.isArray(p.colors) ? p.colors : []
      }));
    } catch (e: any) {
      this.logger.error(`Failed to generate color palettes: ${e.message}`);
      return this.getDefaultPalettes();
    }
  }

  private getDefaultPalettes(): ColorPalette[] {
    return [
      { name: 'Navy & Gold', colors: ['#162231', '#D4AF37'] },
      { name: 'Charcoal & Crimson', colors: ['#333333', '#8B0000'] },
      { name: 'Forest Green & Earth', colors: ['#2E4A35', '#8B7355'] },
      { name: 'Steel Blue & Slate', colors: ['#4682B4', '#708090'] }
    ];
  }
}
