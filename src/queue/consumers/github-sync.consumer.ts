import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../common/constants/queue-names.constant';
import { Octokit } from '@octokit/rest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { DeploymentService } from '../../deployment/deployment.service';

const execFileAsync = promisify(execFile);

export interface GithubSyncJobData {
  projectId: string;
  userId: string;
  repoName: string;
  directory: string;
  commitMessage: string;
  triggerDeployment?: boolean;
}

@Processor(QUEUE_NAMES.GITHUB_SYNC, { concurrency: 1 })
@Injectable()
export class GithubSyncConsumer extends WorkerHost {
  private readonly logger = new Logger(GithubSyncConsumer.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly deploymentService: DeploymentService
  ) {
    super();
  }

  async process(job: Job<GithubSyncJobData>): Promise<void> {
    const { projectId, userId, repoName, directory, commitMessage, triggerDeployment } = job.data;
    
    this.logger.log(`[${projectId}] Starting GitHub sync for repo: ${repoName}...`);

    const token = this.configService.get<string>('GITHUB_API_TOKEN');
    if (!token) throw new Error('GITHUB_API_TOKEN is not configured');

    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const remoteUrl = `https://${user.login}:${token}@github.com/${user.login}/${repoName}.git`;

    try {
      // Init git, add remote, commit, and push
      try {
        await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: directory });
      } catch {
        await execFileAsync('git', ['init'], { cwd: directory });
      }
      
      const commitEmail = process.env.GITHUB_AUTHOR_EMAIL || user.email || 'ads@contractingempire.com';
      const commitName = process.env.GITHUB_AUTHOR_NAME || user.login || 'ads-baim';
      await execFileAsync('git', ['config', 'user.name', commitName], { cwd: directory });
      await execFileAsync('git', ['config', 'user.email', commitEmail], { cwd: directory });
      
      await execFileAsync('git', ['add', '.'], { cwd: directory });
      
      try {
          await execFileAsync('git', ['commit', '-m', commitMessage], { cwd: directory });
      } catch (commitErr: any) {
          if (commitErr.message.includes('nothing to commit')) {
              this.logger.log(`[${projectId}] No changes to commit for ${repoName}`);
              return;
          }
          throw commitErr;
      }
      
      await execFileAsync('git', ['branch', '-M', 'main'], { cwd: directory });
      await execFileAsync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: directory }).catch(() => {
          return execFileAsync('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: directory });
      });
      await execFileAsync('git', ['push', '-u', 'origin', 'main', '--force'], { cwd: directory });
      
      this.logger.log(`[${projectId}] Successfully pushed to GitHub repository ${repoName}`);

      if (triggerDeployment) {
        this.logger.log(`[${projectId}] Triggering Vercel deployment tracking...`);
        await this.deploymentService.deployProjectFromGithub(projectId, userId, user.login, repoName);
      }

    } catch (error: any) {
      this.logger.error(`[${projectId}] Failed to push to GitHub: ${error.message}`);
      throw error;
    } finally {
      // Clean up the temp directory to free disk space after successful push
      await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}
