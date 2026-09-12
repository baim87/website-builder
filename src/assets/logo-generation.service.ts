import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { SkillLoggerService } from '../skills/skill-logger.service';
import { AIModel } from '../common/constants/ai-models.constant';
import { AISkill } from '../common/constants/ai-skills.constant';

@Injectable()
export class LogoGenerationService {
  private readonly logger = new Logger(LogoGenerationService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly skillLogger: SkillLoggerService,
  ) {}

  async generateLogoAndFavicon(projectId: string, bName: string, trade: string, brandHints: string) {
    const prompt = `A professional vector logo for a contractor business named "${bName}". 
The design MUST feature clean, bold typography containing the text "${bName}", alongside a modern, minimal icon related to the ${trade} industry.
Brand guidelines/colors to strictly follow: ${brandHints}.
Style: flat vector, corporate, high-end, similar to modern service brands. 
The background MUST be transparent (no background).`;
    
    this.logger.log(`Calling OpenRouter for logo generation...`);
    const openRouterResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: AIModel.RECRAFT_VECTOR,
        messages: [{ role: 'user', content: prompt }]
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
    
    this.logger.log(`Downloading generated logo from ${imageUrl}`);
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgRes.data);
    
    // Extract cost and save to SkillInvocation for CostAggregator
    const cost = openRouterResponse.data.usage?.cost || 0;
    if (cost > 0) {
      await this.skillLogger.logInvocation({
        projectId,
        skillType: AISkill.LOGO_GENERATION,
        model: AIModel.RECRAFT_VECTOR,
        inputHash: 'logo-gen',
        status: 'success',
        cost: cost,
        metadata: { phase: 'generation', componentName: 'Logo' }
      });
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const userId = project ? project.userId : 'unknown-user';

    // 1. Upload Original SVG Logo
    const logoHash = crypto.createHash('md5').update(buffer).digest('hex');
    const logoKey = `${userId}/projects/${projectId}/assets/images/logo/${logoHash}-logo.svg`;
    const uploadedLogoUrl = await this.storageService.upload(logoKey, buffer, 'image/svg+xml');
    
    await this.prisma.asset.create({
      data: {
        projectId,
        url: uploadedLogoUrl,
        type: 'image',
        purpose: 'logo',
        section: 'header,footer',
      },
    });
    
    this.logger.log(`Logo saved to DB: ${uploadedLogoUrl}`);

    // 2. Generate Favicon (32x32 PNG)
    try {
      this.logger.log(`Rasterizing SVG to 32x32 Favicon...`);
      const faviconBuffer = await sharp(buffer).resize(32, 32).png().toBuffer();
      const faviconKey = `${userId}/projects/${projectId}/assets/images/logo/${logoHash}-favicon.png`;
      const uploadedFaviconUrl = await this.storageService.upload(faviconKey, faviconBuffer, 'image/png');
      
      await this.prisma.asset.create({
        data: {
          projectId,
          url: uploadedFaviconUrl,
          type: 'image',
          purpose: 'favicon',
          section: 'head',
        },
      });
      this.logger.log(`Favicon saved to DB: ${uploadedFaviconUrl}`);
    } catch (faviconErr) {
      this.logger.warn(`Could not generate favicon from SVG: ${faviconErr}`);
    }

    return uploadedLogoUrl;
  }
}
