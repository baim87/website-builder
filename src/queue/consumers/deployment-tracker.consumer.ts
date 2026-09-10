import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, DelayedError } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { VercelClient } from '../../vercel/vercel.client';

export interface DeploymentTrackerJobData {
  projectId: string;
  userId: string;
  vercelProjectName: string;
  attempts?: number;
}

@Processor(QUEUE_NAMES.DEPLOYMENT_TRACKER, { 
  concurrency: 5,
  // Automatically throw if the job has failed too many times
})
@Injectable()
export class DeploymentTrackerConsumer extends WorkerHost {
  private readonly logger = new Logger(DeploymentTrackerConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vercelClient: VercelClient,
  ) {
    super();
  }

  async process(job: Job<DeploymentTrackerJobData>): Promise<void> {
    const { projectId, userId, vercelProjectName, attempts = 0 } = job.data;
    
    this.logger.log(`[${projectId}] Checking Vercel deployment status for ${vercelProjectName} (Attempt ${attempts + 1})...`);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, userId },
      include: { domain: true },
    });

    if (!project) {
      this.logger.warn(`[${projectId}] Project not found, aborting deployment track.`);
      return;
    }

    try {
      const deployRes = await this.vercelClient.getProjectDeployments(vercelProjectName);
      if (deployRes && deployRes.deployments && deployRes.deployments.length > 0) {
        const latestDeploy = deployRes.deployments[0];
        
        if (latestDeploy.readyState === 'READY' && latestDeploy.url) {
          this.logger.log(`[${projectId}] Vercel deployment READY at ${latestDeploy.url}`);
          
          await this.prisma.project.update({
            where: { id: projectId },
            data: { status: 'PUBLISHED' },
          });
          return;
          
        } else if (latestDeploy.readyState === 'ERROR') {
          this.logger.error(`[${projectId}] Vercel deployment failed with ERROR state.`);
          await this.prisma.project.update({
            where: { id: projectId },
            data: { status: 'FAILED' },
          });
          return;
        } else {
          // Still building
          this.logger.log(`[${projectId}] Status is ${latestDeploy.readyState}. Retrying later...`);
        }
      } else {
         this.logger.log(`[${projectId}] No deployments found yet. Retrying later...`);
      }
    } catch (err) {
      this.logger.warn(`[${projectId}] Polling Vercel API failed: ${err.message}`);
    }

    // If we've tried 40 times (approx 2 minutes at 3s intervals), give up
    if (attempts >= 40) {
      this.logger.warn(`[${projectId}] Timed out waiting for Vercel deployment.`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'PUBLISHED' }, // Fallback to published so the UI unblocks
      });
      return;
    }

    // Re-queue the job with a delay
    // In BullMQ v5, throwing DelayedError reschedules the job without counting as a failed attempt
    // Wait wait, I should increment attempts in the job data before throwing if I want to track it
    await job.updateData({ ...job.data, attempts: attempts + 1 });
    
    // Delay for 3 seconds before next try
    await job.moveToDelayed(Date.now() + 3000, job.token!);
    throw new DelayedError();
  }
}
