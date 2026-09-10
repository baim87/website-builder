import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import axios from 'axios';
import * as fs from 'fs';
import { z } from 'zod';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';

export const BrandExtractionSchema = z.object({
  colors: z.object({
    primary: z.string().describe('The primary dominant color of the logo in HEX format'),
    secondary: z.string().describe('The secondary supporting color in HEX format'),
    accent: z.string().describe('An accent color in HEX format'),
    headerBg: z.string().describe('A contrasting background color for the Header, derived from the logo but suitable for readability.'),
    footerBg: z.string().describe('A contrasting background color for the Footer. MUST NOT BE THE SAME AS headerBg to ensure visual separation.'),
  }),
  typography: z.object({
    headingFont: z.string().describe('Suggested Google Font name for headings based on logo style'),
    bodyFont: z.string().describe('Suggested Google Font name for body text based on logo style'),
  }),
});

@Injectable()
export class BrandExtractionService {
  private readonly logger = new Logger(BrandExtractionService.name);

  constructor(private readonly aiGateway: AIGatewayService) {}

  async extractBrandFromLogo(logoUrlOrPath: string): Promise<z.infer<typeof BrandExtractionSchema>> {
    this.logger.log(`Extracting brand colors and fonts from ${logoUrlOrPath}`);
    
    let base64Image = '';
    let mimeType = 'image/png';
    
    if (logoUrlOrPath.startsWith('http://') || logoUrlOrPath.startsWith('https://')) {
      const res = await axios.get(logoUrlOrPath, { 
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      mimeType = (res.headers['content-type'] as string) || 'image/png';
      base64Image = Buffer.from(res.data).toString('base64');
    } else {
      if (!fs.existsSync(logoUrlOrPath)) {
        throw new Error(`Logo file not found at ${logoUrlOrPath}`);
      }
      base64Image = fs.readFileSync(logoUrlOrPath).toString('base64');
      if (logoUrlOrPath.endsWith('.jpg') || logoUrlOrPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (logoUrlOrPath.endsWith('.webp')) mimeType = 'image/webp';
    }

    const fullJsonSchema = zodToJsonSchema(BrandExtractionSchema, 'BrandExtraction');
    const bareJsonSchema = fullJsonSchema.definitions
      ? fullJsonSchema.definitions['BrandExtraction']
      : fullJsonSchema;
    if ((bareJsonSchema as any).$schema) delete (bareJsonSchema as any).$schema;

    const prompt = `Analyze this logo and extract the exact brand color palette (primary, secondary, accent) in HEX format. Then, suggest suitable Google Fonts for headings and body text that match the logo's aesthetic. Output the data using the provided tool.`;

    const result = await this.aiGateway.generateText('anthropic/claude-fable-5', {
      systemPrompt: 'You are a brand extraction expert. Analyze the image and extract accurate HEX colors and matching typography.',
      messages: [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } }
          ] 
        }
      ],
      maxTokens: 1024,
      schema: bareJsonSchema,
      schemaName: 'BrandExtraction'
    });

    try {
      let raw = result.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      return BrandExtractionSchema.parse(JSON.parse(raw));
    } catch (e) {
      this.logger.error(`Failed to parse extracted brand data: ${result.text}`);
      throw e;
    }
  }
}
