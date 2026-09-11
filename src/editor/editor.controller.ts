import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { BlockEditorService } from './block-editor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('editor')
@UseGuards(JwtAuthGuard)
export class EditorController {
  constructor(private readonly blockEditorService: BlockEditorService) {}

  @Post('apply-edit')
  async applyEdit(
    @Body() body: { projectId: string, pageSlug: string, blockId: string, instruction: string }
  ) {
    const { projectId, pageSlug, blockId, instruction } = body;
    return await this.blockEditorService.applyEdit(projectId, pageSlug, blockId, instruction);
  }

  @Post('publish')
  async publishEdits(
    @Req() req: Request,
    @Body() body: { projectId: string; edits: { pageId: string; blockId: string; content: any; baseVersion: number }[] }
  ) {
    const { projectId, edits } = body;
    // @ts-ignore - req.user is set by AuthGuard
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return await this.blockEditorService.publishEdits(projectId, userId, edits);
  }
}
