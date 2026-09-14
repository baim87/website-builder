import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { SkillLoggerService } from '../skills/skill-logger.service';
import { AIModel } from '../common/constants/ai-models.constant';
import { AISkill } from '../common/constants/ai-skills.constant';
import { SKILL_STATUS } from '../skills/constants/skill-status.constant';

@Injectable()
export class LogoGenerationService {
  private readonly logger = new Logger(LogoGenerationService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly skillLogger: SkillLoggerService,
  ) {}

  async generateLogoVariants(projectId: string, bName: string, trade: string, brandHints: string): Promise<string[]> {
    const prompt = `A professional, high-end vector logo for a contractor business named "${bName}". 
The design MUST feature clean, bold typography containing the text "${bName}", alongside a modern, minimal icon related to the ${trade} industry.

BRAND GUIDELINES TO FOLLOW STRICTLY:
${brandHints}
(This contains the exact finalized typography, fonts, and hex color codes the AI just created for the user).

Style: flat vector, corporate, high-end, similar to modern service brands. 
The layout must be a horizontal lockup (icon on the left or top, text on the right or bottom).
The background MUST be completely transparent (no background).`;

    this.logger.log(`Generating 3 Logo variants for ${projectId}...`);
    const promises = [1, 2, 3].map(() => this.generateSingleImage(projectId, prompt, AISkill.LOGO_GENERATION, 'logo.svg', 'image/svg+xml'));
    
    const results = await Promise.allSettled(promises);
    const urls = results.filter(r => r.status === 'fulfilled').map((r: any) => r.value);
    
    if (urls.length === 0) {
      throw new Error("Failed to generate any logo variants.");
    }
    return urls;
  }

  async generateFaviconVariants(projectId: string, bName: string, trade: string, referenceLogoUrl: string): Promise<string[]> {
    const prompt = `A professional, high-end vector favicon (app icon) for a contractor business named "${bName}".
The design MUST NOT contain full words. It must ONLY be a bold, minimal icon related to the ${trade} industry, OR a clean 1-2 letter monogram (e.g. initial letters of the business).

This favicon MUST perfectly match the visual style of the reference image provided.

Style: flat vector, corporate, minimal, high-end. 
The layout MUST be perfectly centered and fit entirely within a square frame.
The background MUST be completely transparent (no background).`;

    this.logger.log(`Generating 3 Favicon variants for ${projectId} using reference ${referenceLogoUrl}...`);
    
    // We pass the reference logo as an image URL in the prompt message
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: referenceLogoUrl } }
        ]
      }
    ];

    const promises = [1, 2, 3].map(() => this.generateSingleImageWithMessages(projectId, messages, AISkill.LOGO_GENERATION, 'favicon.svg', 'image/svg+xml'));
    
    const results = await Promise.allSettled(promises);
    const urls = results.filter(r => r.status === 'fulfilled').map((r: any) => r.value);
    
    if (urls.length === 0) {
      throw new Error("Failed to generate any favicon variants.");
    }
    
    // Convert the SVGs to 32x32 PNGs for actual favicon usage, wait actually we can just store them as SVG and the frontend can render them. 
    // Usually favicons are ICO or PNG, but SVG is fine for modern browsers. However, to match previous behavior, we rasterize to PNG.
    const pngUrls = await Promise.all(urls.map(svgUrl => this.convertToPngFavicon(projectId, svgUrl)));
    return pngUrls;
  }

  private async convertToPngFavicon(projectId: string, svgUrl: string): Promise<string> {
    try {
      const imgRes = await axios.get(svgUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgRes.data);
      const faviconBuffer = await sharp(buffer).resize(64, 64).png().toBuffer(); // 64x64 is better for variants display
      
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      const userId = project ? project.userId : 'unknown-user';
      const hash = crypto.randomBytes(8).toString('hex');
      const faviconKey = `${userId}/projects/${projectId}/assets/images/logo/favicon-var-${hash}.png`;
      
      return await this.storageService.upload(faviconKey, faviconBuffer, 'image/png');
    } catch (e) {
      this.logger.warn(`Failed to convert SVG favicon to PNG: ${e}`);
      return svgUrl; // Fallback to SVG
    }
  }

  private async generateSingleImage(projectId: string, prompt: string, skillType: string, filenameSuffix: string, mimeType: string): Promise<string> {
    return this.generateSingleImageWithMessages(projectId, [{ role: 'user', content: prompt }], skillType, filenameSuffix, mimeType);
  }

  private async generateSingleImageWithMessages(projectId: string, messages: any[], skillType: string, filenameSuffix: string, mimeType: string): Promise<string> {
    const openRouterResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: AIModel.RECRAFT_VECTOR,
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Contractor Website Builder',
          'Content-Type': 'application/json'
        }
      }
    );
    
    const message = openRouterResponse.data.choices[0].message;
    const content = message.content || "";
    
    let imageUrl = '';
    if (message.images && message.images.length > 0) {
      imageUrl = message.images[0].image_url.url;
    } else {
      const urlMatch = content.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
      if (urlMatch && urlMatch[1]) {
        imageUrl = urlMatch[1];
      } else if (content.startsWith("http")) {
        imageUrl = content.trim();
      }
    }
    
    if (!imageUrl) {
      throw new Error("Could not parse image URL from AI response.");
    }
    
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgRes.data);
    
    const cost = openRouterResponse.data.usage?.cost || 0;
    if (cost > 0) {
      await this.skillLogger.logInvocation({
        projectId,
        skillType,
        model: AIModel.RECRAFT_VECTOR,
        inputHash: 'variant-gen',
        status: SKILL_STATUS.SUCCESS,
        cost: cost,
        metadata: { phase: 'generation', componentName: filenameSuffix }
      });
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const userId = project ? project.userId : 'unknown-user';
    const hash = crypto.randomBytes(8).toString('hex');
    const key = `${userId}/projects/${projectId}/assets/images/logo/var-${hash}-${filenameSuffix}`;
    
    return await this.storageService.upload(key, buffer, mimeType);
  }
}
