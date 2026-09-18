import { Controller, Post, Body, UseGuards, Req, Param } from '@nestjs/common';
import { BlockEditorService } from './block-editor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('editor')
@UseGuards(JwtAuthGuard)
export class EditorController {
  constructor(private readonly blockEditorService: BlockEditorService) {}

  @Post(':projectId/apply-edit')
  async applyEdit(
    @Param('projectId') projectId: string,
    @Body() body: { pageSlug: string, blockId: string, instruction: string }
  ) {
    const { pageSlug, blockId, instruction } = body;
    return await this.blockEditorService.applyEdit(projectId, pageSlug, blockId, instruction);
  }

  @Post(':projectId/publish')
  async publishEdits(
    @Param('projectId') projectId: string,
    @Req() req: Request,
    @Body() body: { edits: { pageId: string; blockId: string; content: any; baseVersion: number }[] }
  ) {
    const { edits } = body;
    // @ts-ignore - req.user is set by AuthGuard
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return await this.blockEditorService.publishEdits(projectId, userId, edits);
  }
}
