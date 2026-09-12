import { Controller, Post, Get, Delete, Patch, Param, UseGuards, UseInterceptors, UploadedFile, Body, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BrandAssetIngestionService } from './brand-asset-ingestion.service';
import { BrandExportService } from './brand-export.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly brandAssetIngestionService: BrandAssetIngestionService,
    private readonly brandExportService: BrandExportService,
  ) {}

  @Post('brand-kit/generate')
  async generateBrandKit(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    const url = await this.brandExportService.generateBrandKit(projectId, req.user.id);
    return { url };
  }

  @Post('logo/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogoAsset(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.brandAssetIngestionService.processAsset(projectId, req.user.id, 'logo', file.buffer, file.mimetype);
  }

  @Post('favicon/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFaviconAsset(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.brandAssetIngestionService.processAsset(projectId, req.user.id, 'favicon', file.buffer, file.mimetype);
  }

  @Post('logo/url')
  uploadLogoAssetUrl(
    @Param('projectId') projectId: string,
    @Body('url') url: string,
    @Request() req: any,
  ) {
    return this.brandAssetIngestionService.processAsset(projectId, req.user.id, 'logo', url);
  }

  @Post('favicon/url')
  uploadFaviconAssetUrl(
    @Param('projectId') projectId: string,
    @Body('url') url: string,
    @Request() req: any,
  ) {
    return this.brandAssetIngestionService.processAsset(projectId, req.user.id, 'favicon', url);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('purpose') purpose: string,
    @Body('section') section: string | undefined,
    @Request() req: any,
  ) {
    return this.assetsService.uploadAsset(projectId, req.user.id, file, purpose, section);
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
