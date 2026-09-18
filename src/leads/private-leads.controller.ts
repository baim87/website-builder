import { Controller, Get, Patch, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/leads')
export class PrivateLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async getLeads(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leadsService.findLeadsByProject(projectId, userId);
  }

  @Patch(':leadId')
  async updateLead(
    @Param('projectId') projectId: string,
    @Param('leadId') leadId: string,
    @CurrentUser('id') userId: string,
    @Body() updateData: { status?: string, isRead?: boolean },
  ) {
    return this.leadsService.updateLeadStatus(projectId, leadId, userId, updateData);
  }

  @Patch(':leadId/move')
  async moveLead(
    @Param('projectId') projectId: string,
    @Param('leadId') leadId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { stageId: string, position: number },
  ) {
    return this.leadsService.moveLead(projectId, leadId, userId, data.stageId, data.position);
  }

  // --- STAGE ENDPOINTS ---

  @Get('stages')
  async getStages(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leadsService.getStages(projectId, userId);
  }

  @Post('stages')
  async createStage(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { name: string; color?: string },
  ) {
    return this.leadsService.createStage(projectId, userId, data);
  }

  @Patch('stages/:stageId')
  async updateStage(
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { name?: string; color?: string; isDefault?: boolean },
  ) {
    return this.leadsService.updateStage(projectId, stageId, userId, data);
  }

  @Delete('stages/:stageId')
  async deleteStage(
    @Param('projectId') projectId: string,
    @Param('stageId') stageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.leadsService.deleteStage(projectId, stageId, userId);
  }

  @Put('stages/reorder')
  async reorderStages(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { stageIds: string[] },
  ) {
    return this.leadsService.reorderStages(projectId, userId, data.stageIds);
  }
}
