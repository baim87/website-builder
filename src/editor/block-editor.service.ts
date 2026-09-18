import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComponentEditorSkill } from '../skills/impl/component-editor.skill';
import { findNodeById, replaceNodeById } from '../utils/ast-utils';
import { DeploymentService } from '../deployment/deployment.service';
import { GenerationProducer } from '../queue/producers/generation.producer';

export interface DraftEdit {
  pageId: string; // The page slug actually (e.g. '/' or 'about-us')
  blockId: string;
  content: any; // ASTNode
  baseVersion: number;
}

@Injectable()
export class BlockEditorService {
  private readonly logger = new Logger(BlockEditorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly componentEditorSkill: ComponentEditorSkill,
    private readonly deploymentService: DeploymentService,
    private readonly generationProducer: GenerationProducer,
  ) {}

  /**
   * Applies an AI edit to a specific block and returns the updated node (does NOT save to DB).
   * This is used for Lifecycle A (Client-Side Draft State).
   */
  async applyEdit(projectId: string, pageSlug: string, blockId: string, instruction: string) {
    this.logger.log(`Applying edit to block ${blockId} on page ${pageSlug} for project ${projectId}`);

    const page = await this.prisma.page.findUnique({
      where: { projectId_slug: { projectId, slug: pageSlug } },
      include: {
        project: {
          include: {
            businessContext: true,
            websiteData: true
          }
        }
      }
    });

    if (!page) {
      throw new NotFoundException(`Page ${pageSlug} not found`);
    }

    let targetNode = null;

    // Traverse the sections array to find the node
    if (page.content && Array.isArray(page.content)) {
      for (const section of page.content) {
        const sec = section as any;
        if (sec && sec.id === blockId) {
          targetNode = sec.ast;
          // Inject the ID into the AST node so the AI sees it and validation preserves it
          targetNode.id = sec.id;
          break;
        }
        if (sec && sec.ast) {
          const found = findNodeById(sec.ast, blockId);
          if (found) {
            targetNode = found;
            break;
          }
        }
      }
    }

    if (!targetNode) {
      throw new NotFoundException(`Block with ID ${blockId} not found in the AST.`);
    }

    const componentCode = (page.project.websiteData?.customComponents as Record<string, string>)?.[targetNode.type] || undefined;

    // Pass the node, instruction, and brand context to the AI
    const result = await this.componentEditorSkill.execute({
      projectId,
      context: { 
        targetNode, 
        componentCode,
        instruction,
        brandContext: {
          businessContext: page.project.businessContext,
          designTokens: page.project.websiteData?.designTokens
        }
      },
      metadata: { phase: 'editor' }
    });

    let rebuildTriggered = false;
    const { astNode, tsxCode, requiresCodeUpdate } = result.data as any;

    if (requiresCodeUpdate && tsxCode) {
      this.logger.log(`AI modified TSX code for ${targetNode.type}. Updating DB and triggering rebuild...`);
      const customComponents = (page.project.websiteData?.customComponents || {}) as any;
      customComponents[targetNode.type] = tsxCode;
      
      await this.prisma.websiteData.update({
        where: { id: page.project.websiteData!.id },
        data: { customComponents }
      });

      await this.generationProducer.generateSite(projectId, 'ai');
      rebuildTriggered = true;
    }

    // Update the DB immediately so the iframe reload fetches the fresh AST
    let currentContent = page.content;
    if (currentContent && Array.isArray(currentContent)) {
      currentContent = currentContent.map((section: any) => {
        if (section.id === blockId) {
          section.ast = astNode;
        } else if (section.ast) {
          section.ast = replaceNodeById(section.ast, blockId, astNode);
        }
        return section;
      });

      await this.prisma.page.update({
        where: { id: page.id },
        data: {
          content: currentContent as any,
          // @ts-ignore
          contentVersion: { increment: 1 },
        }
      });
    }

    return {
      success: true,
      blockId,
      newNode: astNode,
      // @ts-ignore - Prisma might be cached
      baseVersion: (page.contentVersion || 1) + 1,
      rebuildTriggered,
    };
  }

  /**
   * Batch publishes client-side drafts to the database, enforcing optimistic concurrency.
   * This is used for Lifecycle B (Server-Side Batch Publishing).
   */
  async publishEdits(projectId: string, userId: string, edits: DraftEdit[]) {
    this.logger.log(`Publishing ${edits.length} edits for project ${projectId}`);
    
    // Group edits by page
    const editsByPage = new Map<string, DraftEdit[]>();
    for (const edit of edits) {
      // Normalizing path to slug (e.g. '/' -> 'home')
      const slug = edit.pageId === '/' ? 'home' : edit.pageId.replace(/^\//, '');
      if (!editsByPage.has(slug)) {
        editsByPage.set(slug, []);
      }
      editsByPage.get(slug)!.push(edit);
    }

    const failedBlocks: { blockId: string, reason: string }[] = [];
    const successfulBlocks: string[] = [];
    let revalidateNeeded = false;

    // Process each page transactionally
    for (const [slug, pageEdits] of editsByPage.entries()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const page = await tx.page.findUnique({
            where: { projectId_slug: { projectId, slug } }
          });

          if (!page) {
            throw new Error(`Page ${slug} not found`);
          }

          let contentModified = false;
          let currentContent = page.content;

          // Check all edits for concurrency mismatch
          for (const edit of pageEdits) {
            // @ts-ignore - Prisma types might be cached
            if (page.contentVersion !== edit.baseVersion) {
              // The page was modified by someone else since this draft was created!
              failedBlocks.push({ blockId: edit.blockId, reason: 'CONCURRENCY_CONFLICT' });
              continue;
            }

            if (currentContent && Array.isArray(currentContent)) {
              currentContent = currentContent.map((section: any) => {
                if (section.id === edit.blockId) {
                  section.ast = edit.content;
                } else if (section.ast) {
                  section.ast = replaceNodeById(section.ast, edit.blockId, edit.content);
                }
                return section;
              });
              contentModified = true;
              successfulBlocks.push(edit.blockId);
            }
          }

          if (contentModified) {
            await tx.page.update({
              where: { id: page.id },
              data: {
                content: currentContent as any,
                // @ts-ignore - Prisma types might be cached
                contentVersion: { increment: 1 },
              }
            });
            revalidateNeeded = true;
          }
        });
      } catch (error) {
        this.logger.error(`Failed to publish page ${slug}: ${error.message}`);
      }
    }

    if (revalidateNeeded) {
      // Revalidate all edited paths via DeploymentService
      for (const slug of editsByPage.keys()) {
        const path = slug === 'home' ? '/' : `/${slug}`;
        try {
          await this.deploymentService.revalidateProject(projectId, userId, path);
        } catch (e) {
          this.logger.error(`Failed to revalidate path ${path}: ${e.message}`);
        }
      }
    }

    return {
      success: true,
      published: successfulBlocks,
      failed: failedBlocks,
    };
  }
}

