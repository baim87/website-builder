import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch, UsePipes } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { BusinessContextService } from './business-context.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProjectSchema } from './dto/create-project.dto';
import type { CreateProjectDto } from './dto/create-project.dto';
import { UpdateBusinessContextSchema } from './dto/update-business-context.dto';
import type { UpdateBusinessContextDto } from './dto/update-business-context.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BrandKnowledgeService } from '../brand/brand-knowledge.service';
import { PageService } from './page.service';

import { GenerationProducer } from '../queue/producers/generation.producer';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly businessContextService: BusinessContextService,
    private readonly generationProducer: GenerationProducer,
    private readonly brandKnowledgeService: BrandKnowledgeService,
    private readonly pageService: PageService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateProjectSchema))
  create(@CurrentUser('id') userId: string, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(userId, createProjectDto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.projectsService.findAll(userId);
  }

  @Get('me/status')
  getMyStatus(@CurrentUser('id') userId: string) {
    return this.projectsService.findLatestStatus(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.projectsService.findOne(id, userId);
  }






  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.projectsService.delete(id, userId);
  }

  @Get(':id/business-context')
  getBusinessContext(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.businessContextService.findByProjectId(id, userId);
  }

  @Get(':id/pages')
  getPages(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pageService.getPagesByProjectId(id, userId);
  }

  @Patch(':id/business-context')
  @UsePipes(new ZodValidationPipe(UpdateBusinessContextSchema))
  updateBusinessContext(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateBusinessContextDto,
  ) {
    return this.businessContextService.upsert(id, updateDto, userId);
  }

  @Get(':id/brand-documents/:documentId')
  async getBrandDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
  ) {
    // Verify project belongs to user
    await this.projectsService.findOne(id, userId);

    const mapping: Record<string, string> = {
      'brand-visual': 'brand-visual.md',
      'brand-positioning': 'brand-positioning.md',
      'brand-messaging': 'brand-messaging.md',
      'brand-story': 'brand-story.md',
      'brand-voice': 'brand-voice.md',
      'brand-strategy': 'brand-strategy.md',
    };

    const fileName = mapping[documentId];
    if (!fileName) {
      return { content: `# Document Not Found\nNo mapping for document ID: ${documentId}` };
    }

    const content = await this.brandKnowledgeService.getBrandFile(id, fileName);
    if (!content) {
      return { content: `# Document Pending\nThe ${documentId} document is still being generated or is not available yet.` };
    }

    return { content };
  }

  @Post(':id/generate')
  async triggerGeneration(@Param('id') id: string, @CurrentUser('id') userId: string) {
    // Verify ownership
    await this.projectsService.findOne(id, userId);
    await this.generationProducer.generateSite(id, userId);
    return { message: 'Generation queued successfully' };
  }
}
