import { Module } from '@nestjs/common';
import { DeploymentService } from './deployment.service';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';

@Module({
  controllers: [DeploymentController],
  providers: [DeploymentService, GithubService],
  exports: [DeploymentService, GithubService],
})
export class DeploymentModule {}
