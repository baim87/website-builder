import { Controller, Post, Get, Param, UseGuards, Request, Body } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/deployment')
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Post('deploy')
  async deploy(@Param('projectId') projectId: string, @Request() req: any) {
    return this.deploymentService.deployProject(projectId, req.user.id);
  }

  @Get('status')
  async getStatus(@Param('projectId') projectId: string, @Request() req: any) {
    return this.deploymentService.getDeploymentStatus(projectId, req.user.id);
  }

  @Post('revalidate')
  async revalidate(
    @Param('projectId') projectId: string,
    @Body('path') path: string,
    @Request() req: any,
  ) {
    return this.deploymentService.revalidateProject(projectId, req.user.id, path || '/');
  }
}
