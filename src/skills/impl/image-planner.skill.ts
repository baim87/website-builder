import { Injectable, Logger } from '@nestjs/common';
import { Skill, SkillInput, SkillOutput } from '../interfaces/skill.interface';
import { AIGatewayService } from '../../ai-gateway/ai-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { z } from 'zod';
import { zodToJsonSchema } from '@alcyone-labs/zod-to-json-schema';
import { buildImagePlannerPrompt } from '../prompts/builders/image-planner.prompt';
import { AIModel } from '../../common/constants/ai-models.constant';
import { AISkill } from '../../common/constants/ai-skills.constant';

const ImagePlanSchema = z.object({
  images: z.array(z.object({
    type: z.enum(['HERO', 'PAGE_HEADER', 'GALLERY', 'BEFORE', 'AFTER']),
    prompt: z.string().describe('Highly detailed photography prompt enforcing variety of angles and lighting, NO HUMANS.'),
    service: z.string().describe('The specific service this image belongs to (e.g. kitchen-remodeling). If not tied to a specific service, invent a relevant descriptive name like general-exterior. DO NOT LEAVE BLANK.'),
    linkId: z.string().optional().describe('Unique identifier to link an AFTER image to its corresponding BEFORE image (only use for BEFORE/AFTER pairs)'),
  }))
});

@Injectable()
export class ImagePlannerSkill implements Skill {
  readonly name = AISkill.IMAGE_PLANNER;
  private readonly logger = new Logger(ImagePlannerSkill.name);

  constructor(
    private readonly aiGateway: AIGatewayService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: SkillInput): Promise<SkillOutput> {
    const { businessContext, pagesToGenerate } = input.context;

    if (!businessContext) {
      throw new Error('ImagePlannerSkill requires businessContext');
    }

    const fullJsonSchema = zodToJsonSchema(ImagePlanSchema, 'ImagePlan');
    let bareJsonSchema: any = fullJsonSchema.definitions ? fullJsonSchema.definitions['ImagePlan'] : fullJsonSchema;
    if (bareJsonSchema.$schema) delete bareJsonSchema.$schema;

    const prompt = buildImagePlannerPrompt(businessContext, pagesToGenerate);
    this.logger.log(`Planning image generation strategy...`);

    const response = await this.aiGateway.generateText(AIModel.CLAUDE_FABLE_5, {
      systemPrompt: 'You are an expert Photography Director. Output strictly matching the requested JSON schema via the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // Slightly higher for diverse angles
      maxTokens: 8192,
      schema: bareJsonSchema,
      schemaName: 'ImagePlan',
    });

    let parsed: any;
    try {
      let raw = response.text.trim();
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) raw = fenceMatch[1].trim();
      if (!raw.startsWith('{') && raw.includes('{')) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end > start) raw = raw.substring(start, end + 1);
      }
      parsed = JSON.parse(raw || '{}');
    } catch (e) {
      this.logger.error(`Failed to parse LLM output as JSON: ${response.text}`);
      throw new Error(`ImagePlanner LLM returned unparseable output`);
    }

    const validatedData = ImagePlanSchema.parse(parsed);

    // Save planned assets to the database (in 'pending' status)
    const plannedAssets = [];
    const processedLinkIds = new Set<string>();

    for (const img of validatedData.images) {
      if (img.type === 'BEFORE') {
        const beforeAsset = await this.prisma.projectAsset.create({
          data: {
            projectId: input.projectId,
            type: 'BEFORE',
            prompt: img.prompt,
            status: 'pending',
            metadata: { service: img.service, linkId: img.linkId } as any
          }
        });
        plannedAssets.push(beforeAsset);

        if (img.linkId) {
          processedLinkIds.add(img.linkId);
          const afterImg = validatedData.images.find(
            i => i.type === 'AFTER' && i.linkId === img.linkId
          );
          if (afterImg) {
            const afterAsset = await this.prisma.projectAsset.create({
              data: {
                projectId: input.projectId,
                type: 'AFTER',
                prompt: afterImg.prompt,
                status: 'pending',
                referenceAssetId: beforeAsset.id,
                metadata: { service: afterImg.service, linkId: afterImg.linkId } as any
              }
            });
            plannedAssets.push(afterAsset);
          }
        }
      } else if (img.type === 'AFTER') {
        if (img.linkId && !processedLinkIds.has(img.linkId)) {
          // Orphaned AFTER, treat as normal asset
          const asset = await this.prisma.projectAsset.create({
            data: {
              projectId: input.projectId,
              type: img.type,
              prompt: img.prompt,
              status: 'pending',
              metadata: { service: img.service, linkId: img.linkId } as any
            }
          });
          plannedAssets.push(asset);
        }
      } else { // HERO, PAGE_HEADER, GALLERY
        const asset = await this.prisma.projectAsset.create({
          data: {
            projectId: input.projectId,
            type: img.type,
            prompt: img.prompt,
            status: 'pending',
            metadata: { service: img.service } as any
          }
        });
        plannedAssets.push(asset);
      }
    }

    const hash = crypto.createHash('sha256').update(JSON.stringify(plannedAssets)).digest('hex');

    return {
      data: { assets: plannedAssets },
      hash,
      model: AIModel.CLAUDE_FABLE_5,
      usage: (response as any).usage || response.usage,
    };
  }
}
