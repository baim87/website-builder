import { Controller, Post, Param, Body, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';

@Controller('public/leads/:projectId')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // Note: This endpoint is intentionally NOT protected by JwtAuthGuard
  // because it is called by anonymous homeowners visiting the public website.
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  async submitLead(
    @Param('projectId') projectId: string,
    @Body() leadData: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.leadsService.forwardLead(projectId, leadData, files);
  }
}
