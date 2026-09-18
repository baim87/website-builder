import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { ImageGenerationJobData } from '../interfaces/job-data.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ImageProcessorService } from '../../assets/image-processor.service';
import { ConfigService } from '@nestjs/config';
import { AssetPathResolverService } from '../../assets/asset-path-resolver.service';
import { ImageCritiqueService } from '../../quality-control/image-critique.service';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';
import { ASSET_STATUS } from '../../assets/constants/asset-status.constant';
import { SKILL_STATUS } from '../../skills/constants/skill-status.constant';

@Processor(QUEUE_NAMES.IMAGE_GENERATION, {
  concurrency: 2, // process 2 at a time to prevent memory/cpu exhaustion from sharp
})
@Injectable()
export class ImageGenerationConsumer extends WorkerHost {
  private readonly logger = new Logger(ImageGenerationConsumer.name);
  private readonly openRouterApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly configService: ConfigService,
    private readonly pathResolver: AssetPathResolverService,
    private readonly critiqueService: ImageCritiqueService,
  ) {
    super();
    const key = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');
    this.openRouterApiKey = key;
  }

  async process(job: Job<ImageGenerationJobData>): Promise<void> {
    const { projectAssetId, projectId, userId } = job.data;

    // Get total and completed counts for progress tracking
    const [totalAssets, completedAssets] = await Promise.all([
      this.prisma.projectAsset.count({ where: { projectId } }),
      this.prisma.projectAsset.count({ where: { projectId, status: ASSET_STATUS.COMPLETED } }),
    ]);
    const currentNum = completedAssets + 1;
    const progressTag = `[${currentNum}/${totalAssets}]`;

    this.logger.log(`${progressTag} ━━━ Starting image generation for asset: ${projectAssetId} ━━━`);

    try {
      const asset = await this.prisma.projectAsset.findUnique({
        where: { id: projectAssetId },
      });

      if (!asset || !asset.prompt) {
        throw new Error(`Asset ${projectAssetId} not found or missing prompt`);
      }

      const promptPreview = asset.prompt.length > 120 ? asset.prompt.substring(0, 120) + '...' : asset.prompt;
      this.logger.log(`${progressTag} Type: ${asset.type} | Prompt: "${promptPreview}"`);

      await this.prisma.projectAsset.update({
        where: { id: projectAssetId },
        data: { status: ASSET_STATUS.GENERATING },
      });

      let referenceBase64: string | undefined;

      // Handle img2img reference
      if (asset.referenceAssetId) {
        this.logger.log(`Asset relies on reference asset: ${asset.referenceAssetId}`);
        const refAsset = await this.prisma.projectAsset.findUnique({
          where: { id: asset.referenceAssetId },
        });
        
        if (!refAsset || !refAsset.originalUrl) {
          throw new Error(`Reference asset ${asset.referenceAssetId} is missing or has no originalUrl`);
        }

        const res = await fetch(refAsset.originalUrl);
        if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.statusText}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        referenceBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }

      let currentPrompt = asset.prompt;
      let finalBuffer: Buffer | null = null;
      const maxGenAttempts = 3;
      let totalCost = 0;
      const genStartTime = Date.now();

      for (let genAttempt = 1; genAttempt <= maxGenAttempts; genAttempt++) {
        this.logger.log(`${progressTag} Calling OpenRouter API (Attempt ${genAttempt}/${maxGenAttempts})...`);
        const { imageUrl, cost, latencyMs, tokens } = await this.generateImageFromOpenRouter(
          currentPrompt, 
          referenceBase64
        );
        totalCost += cost;
        
        this.logger.log(`${progressTag} ✓ Image generated | Latency: ${(latencyMs / 1000).toFixed(1)}s | Tokens: (In: ${tokens.prompt}, Out: ${tokens.completion}) | Cost: $${cost.toFixed(6)}`);
        
        let buffer: Buffer;
        if (imageUrl.startsWith('data:image')) {
          const base64Data = imageUrl.split(',')[1];
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          const res = await fetch(imageUrl);
          if (!res.ok) throw new Error(`Failed to download generated image: ${res.statusText}`);
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        }

        if (genAttempt === maxGenAttempts) {
          finalBuffer = buffer;
          break; // Accept whatever we have on the final attempt
        }

        // Delegate critique to the dedicated service
        const critiqueResult = await this.critiqueService.critiqueImage(buffer, currentPrompt, progressTag);
        
        if (critiqueResult.isValid) {
          this.logger.log(`${progressTag} ✓ Image passed self-critique.`);
          finalBuffer = buffer;
          break;
        } else {
          this.logger.warn(`${progressTag} Image failed critique: ${critiqueResult.critique}`);
          currentPrompt = critiqueResult.suggestedNewPrompt;
        }
      }
      
      const bufferToUse = finalBuffer!;

      // Optimize
      const originalSizeKB = (bufferToUse.length / 1024).toFixed(1);
      this.logger.log(`${progressTag} Optimizing image (${originalSizeKB} KB original)...`);
      const webpBuffer = await this.imageProcessor.convertToWebp(bufferToUse);
      const webpSizeKB = (webpBuffer.length / 1024).toFixed(1);
      const savings = (100 - (webpBuffer.length / bufferToUse.length) * 100).toFixed(0);
      this.logger.log(`${progressTag} ✓ Optimized: ${originalSizeKB} KB → ${webpSizeKB} KB (${savings}% savings)`);

      // Upload to R2 using path resolver
      this.logger.log(`${progressTag} Uploading to R2 storage...`);

      const metadata = asset.metadata as any;
      const serviceName = metadata?.service || 'general';
      
      const { originalKey, webpKey } = this.pathResolver.resolveStoragePath(
        userId,
        projectId,
        asset.type,
        serviceName,
        projectAssetId
      );

      const originalUrl = await this.storage.upload(originalKey, bufferToUse, 'image/jpeg');
      const webpUrl = await this.storage.upload(webpKey, webpBuffer, 'image/webp');
      this.logger.log(`${progressTag} ✓ Uploaded to R2`);

      // Update DB
      await this.prisma.projectAsset.update({
        where: { id: projectAssetId },
        data: {
          originalUrl,
          webpUrl,
          cost: totalCost,
          status: ASSET_STATUS.COMPLETED,
        },
      });

      await this.prisma.skillInvocation.create({
        data: {
          projectId,
          skillType: AISkill.IMAGE_GENERATION,
          inputHash: projectAssetId,
          model: AIModel.SEEDREAM_4_5,
          cost: totalCost,
          status: SKILL_STATUS.SUCCESS,
          metadata: { projectAssetId, type: asset.type }
        }
      });

      this.logger.log(`${progressTag} ━━━ COMPLETE: ${asset.type} image | Cost: $${totalCost.toFixed(6)} | Total time: ${((Date.now() - genStartTime) / 1000).toFixed(1)}s ━━━`);

    } catch (error) {
      this.logger.error(`Failed to process image generation for ${projectAssetId}`, error.stack);
      
      await this.prisma.projectAsset.update({
        where: { id: projectAssetId },
        data: { status: ASSET_STATUS.FAILED },
      });

      await this.prisma.skillInvocation.create({
        data: {
          projectId,
          skillType: AISkill.IMAGE_GENERATION,
          inputHash: projectAssetId,
          model: AIModel.SEEDREAM_4_5,
          status: SKILL_STATUS.FAILED,
          error: error.message,
          metadata: { projectAssetId }
        }
      });
      
      throw error;
    }
  }

  private async generateImageFromOpenRouter(prompt: string, referenceBase64?: string): Promise<{ imageUrl: string; cost: number; latencyMs: number; tokens: { prompt: number, completion: number } }> {
    const messages: any[] = [];
    
    if (referenceBase64) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: referenceBase64 } }
            ]
        });
    } else {
        messages.push({
            role: "user",
            content: prompt
        });
    }

    const startTime = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Contractor Website Builder"
        },
        body: JSON.stringify({
            model: AIModel.SEEDREAM_4_5,
            messages
        })
    });

    if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.status} ${await response.text()}`);
    }

    const data: any = await response.json();
    
    // Extract cost and latency
    const cost = data.usage?.cost || 0;
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const latencyMs = Date.now() - startTime;

    let imageUrl = '';
    if (data.choices && data.choices[0].message.images && data.choices[0].message.images.length > 0) {
        imageUrl = data.choices[0].message.images[0].image_url.url;
    } else {
        const textContent = data.choices[0].message.content || "";
        const urlMatch = textContent.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
        
        if (urlMatch && urlMatch[1]) {
            imageUrl = urlMatch[1];
        } else if (textContent.startsWith("http")) {
            imageUrl = textContent.trim();
        } else {
            imageUrl = textContent;
        }
    }

    return { imageUrl, cost, latencyMs, tokens: { prompt: promptTokens, completion: completionTokens } };
  }
}

