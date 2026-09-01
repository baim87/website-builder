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

import { GenerationProducer } from '../queue/producers/generation.producer';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly businessContextService: BusinessContextService,
    private readonly generationProducer: GenerationProducer,
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

  @Patch(':id/business-context')
  @UsePipes(new ZodValidationPipe(UpdateBusinessContextSchema))
  updateBusinessContext(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateBusinessContextDto,
  ) {
    return this.businessContextService.upsert(id, updateDto, userId);
  }

  @Post(':id/generate')
  async triggerGeneration(@Param('id') id: string, @CurrentUser('id') userId: string) {
    // Verify ownership
    await this.projectsService.findOne(id, userId);
    await this.generationProducer.generateSite(id);
    return { message: 'Generation queued successfully' };
  }
}
