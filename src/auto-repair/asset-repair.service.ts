import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';
import { AssetRepairSkill } from '../skills/impl/asset-repair.skill';

@Injectable()
export class AssetRepairService {
  private readonly logger = new Logger(AssetRepairService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillExecutor: SkillExecutorService,
    private readonly assetRepairSkill: AssetRepairSkill,
    @InjectQueue(QUEUE_NAMES.IMAGE_GENERATION) private readonly imageGenerationQueue: Queue,
  ) {}

  /**
   * Identifies the asset by URL, rewrites the prompt using AI, and enqueues it for re-generation.
   * Returns a promise that resolves when the BullMQ job is successfully queued.
   */
  async repairAsset(projectId: string, badImageUrl: string, critiqueDescription: string): Promise<void> {
    this.logger.log(`Initiating asset repair for bad image: ${badImageUrl}`);
    
    // 1. Find the ProjectAsset in the database
    // The visualQA critique returns the Cloudflare R2 public URL, but we just need to match it loosely.
    const project = await this.prisma.project.findUnique({ where: { id: projectId }});
    if (!project) throw new Error('Project not found');

    const assets = await this.prisma.projectAsset.findMany({ where: { projectId } });
    
    // We try to find an asset using the shortId (first 8 chars of UUID) embedded in the URL.
    // This bypasses issues where the date prefix in the URL changes during regeneration.
    const shortIdMatch = badImageUrl.match(/-([a-f0-9]{8})(?:-original)?\.(?:webp|jpg|png|jpeg)/i);
    const shortId = shortIdMatch ? shortIdMatch[1] : null;

    let targetAsset = null;
    if (shortId) {
      targetAsset = assets.find(a => a.id.startsWith(shortId));
    }
    
    // Fallback to exact URL match
    if (!targetAsset) {
      targetAsset = assets.find(a => badImageUrl.includes(a.originalUrl || '$$NOT_FOUND$$') || badImageUrl.includes(a.webpUrl || '$$NOT_FOUND$$'));
    }

    if (!targetAsset) {
      this.logger.warn(`Could not find a ProjectAsset matching URL: ${badImageUrl}`);
      return; // Skip if we can't find it
    }

    if (!targetAsset.prompt) {
      this.logger.warn(`ProjectAsset ${targetAsset.id} has no prompt to rewrite.`);
      return;
    }

    // 2. Execute AssetRepairSkill to rewrite the prompt
    this.logger.log(`Rewriting prompt for ProjectAsset ${targetAsset.id}...`);
    try {
      const repairResult = await this.skillExecutor.executeSkill(this.assetRepairSkill, {
        projectId,
        context: {
          originalPrompt: targetAsset.prompt,
          critique: critiqueDescription
        },
        metadata: { phase: 'repair', assetId: targetAsset.id }
      });

      const newPrompt = repairResult.fixedPrompt;

      // 3. Update the ProjectAsset in the database
      await this.prisma.projectAsset.update({
        where: { id: targetAsset.id },
        data: { 
          prompt: newPrompt,
          status: 'pending' // reset status so the worker picks it up properly
        }
      });

      // 4. Enqueue the Image Generation Job
      this.logger.log(`Queueing new image generation job for ${targetAsset.id}`);
      await this.imageGenerationQueue.add('generate', { projectId, userId: project.userId, projectAssetId: targetAsset.id }, { attempts: 2, backoff: { type: 'exponential', delay: 10000 } });

    } catch (error) {
      this.logger.error(`Failed to repair asset ${targetAsset.id}: ${error.message}`);
    }
  }
}
