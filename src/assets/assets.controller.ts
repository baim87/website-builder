import { Controller, Post, Get, Delete, Patch, Param, UseGuards, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('purpose') purpose: string,
    @Body('section') section?: string,
  ) {
    return this.assetsService.uploadAsset(projectId, file, purpose, section);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.assetsService.getAssets(projectId);
  }

  @Get(':assetId')
  findOne(@Param('projectId') projectId: string, @Param('assetId') assetId: string) {
    return this.assetsService.getAsset(projectId, assetId);
  }

  @Patch(':assetId')
  update(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
    @Body() body: { purpose?: string; section?: string; sortOrder?: number },
  ) {
    return this.assetsService.updateAsset(projectId, assetId, body);
  }

  @Delete(':assetId')
  remove(@Param('projectId') projectId: string, @Param('assetId') assetId: string) {
    return this.assetsService.deleteAsset(projectId, assetId);
  }
}
