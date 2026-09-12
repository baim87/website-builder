import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch, UsePipes, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../common/constants/queue-names.constant';
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
    private readonly configService: ConfigService,
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



  @Sse(':id/generation/stream')
  streamGenerationProgress(
    @Param('id') _projectId: string,
    @Query('jobId') jobId: string
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      if (!jobId) {
        subscriber.complete();
        return;
      }

      const connectionUrl = this.configService.get<string>('REDIS_URL');
      const queueEvents = new QueueEvents(QUEUE_NAMES.SITE_GENERATION, { connection: { url: connectionUrl } });

      const onProgress = (args: { jobId: string; data: number | object }) => {
        if (args.jobId === jobId) {
          subscriber.next({ data: { progress: args.data } } as MessageEvent);
        }
      };

      const onCompleted = (args: { jobId: string; returnvalue: any; prev?: string }) => {
        if (args.jobId === jobId) {
          subscriber.next({ data: { status: 'completed' } } as MessageEvent);
          queueEvents.close();
          subscriber.complete();
        }
      };

      const onFailed = (args: { jobId: string; failedReason: string; prev?: string }) => {
        if (args.jobId === jobId) {
          subscriber.next({ data: { status: 'failed', reason: args.failedReason } } as MessageEvent);
          queueEvents.close();
          subscriber.complete();
        }
      };

      queueEvents.on('progress', onProgress);
      queueEvents.on('completed', onCompleted);
      queueEvents.on('failed', onFailed);

      return () => {
        queueEvents.off('progress', onProgress);
        queueEvents.off('completed', onCompleted);
        queueEvents.off('failed', onFailed);
        queueEvents.close();
      };
    });
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
    await this.generationProducer.generateSite(id, userId);
    return { message: 'Generation queued successfully' };
  }
}
