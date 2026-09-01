import { Controller, Post, Param, Body } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('api/projects/:projectId/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // Note: This endpoint is intentionally NOT protected by JwtAuthGuard
  // because it is called by anonymous homeowners visiting the public website.
  @Post()
  async submitLead(
    @Param('projectId') projectId: string,
    @Body() leadData: any,
  ) {
    return this.leadsService.forwardLead(projectId, leadData);
  }
}
