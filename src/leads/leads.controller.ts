import { Controller, Post, Param, Body, UseInterceptors, UploadedFiles, UsePipes } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { SanitizeLeadPipe } from './pipes/sanitize-lead.pipe';

@Controller('public/leads/:projectId')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // Note: This endpoint is intentionally NOT protected by JwtAuthGuard
  // because it is called by anonymous homeowners visiting the public website.
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 leads per minute per IP
  @UseInterceptors(AnyFilesInterceptor())
  @UsePipes(SanitizeLeadPipe)
  async submitLead(
    @Param('projectId') projectId: string,
    @Body() leadData: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    return this.leadsService.forwardLead(projectId, leadData, files);
  }
}
