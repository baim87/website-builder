import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WebhookDispatchService } from './webhook-dispatch.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/integrations')
export class WebhookIntegrationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookDispatchService: WebhookDispatchService,
  ) {}

  @Get()
  async getIntegrations(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    return this.prisma.webhookIntegration.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post()
  async createIntegration(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { name: string; url: string; secret?: string; isActive?: boolean; headers?: Record<string, string> },
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    return this.prisma.webhookIntegration.create({
      data: {
        projectId,
        name: data.name,
        url: data.url,
        secret: data.secret,
        isActive: data.isActive ?? true,
        headers: data.headers ?? {},
      }
    });
  }

  @Patch(':id')
  async updateIntegration(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() data: { name?: string; url?: string; secret?: string; isActive?: boolean; headers?: Record<string, string> },
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    return this.prisma.webhookIntegration.update({
      where: { id, projectId },
      data,
    });
  }

  @Delete(':id')
  async deleteIntegration(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    return this.prisma.webhookIntegration.delete({
      where: { id, projectId }
    });
  }

  @Post(':id/test')
  async testIntegration(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId }
    });
    if (!project) throw new HttpException('Project not found', HttpStatus.NOT_FOUND);

    const integration = await this.prisma.webhookIntegration.findUnique({
      where: { id, projectId }
    });
    if (!integration) throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);

    const result = await this.webhookDispatchService.sendTestWebhook(id);
    if (!result.success) {
      throw new HttpException({ message: 'Test failed', ...result }, HttpStatus.BAD_REQUEST);
    }
    
    return result;
  }
}
