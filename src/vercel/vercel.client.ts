import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VercelClient {
  private readonly logger = new Logger(VercelClient.name);
  private readonly apiToken: string | undefined;
  private readonly teamId: string | undefined;
  private readonly projectId: string | undefined;
  private readonly baseUrl = 'https://api.vercel.com';

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('VERCEL_API_TOKEN');
    this.teamId = this.configService.get<string>('VERCEL_TEAM_ID');
    this.projectId = this.configService.get<string>('VERCEL_PROJECT_ID');

    if (!this.apiToken || !this.projectId) {
      this.logger.warn('Vercel API token or Project ID is missing. Vercel client operations will fail.');
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private appendTeamId(url: URL): URL {
    if (this.teamId) {
      url.searchParams.append('teamId', this.teamId);
    }
    return url;
  }

  async addDomain(domain: string): Promise<any> {
    this.logger.log(`Adding domain ${domain} to Vercel project ${this.projectId}`);
    
    // Stub implementation if not configured
    if (!this.apiToken || !this.projectId) return { status: 'mocked', domain };

    const url = new URL(`${this.baseUrl}/v10/projects/${this.projectId}/domains`);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name: domain }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HttpException(`Vercel add domain failed: ${error.message || response.statusText}`, response.status);
    }

    return response.json();
  }

  async createDeployment(domain: string): Promise<any> {
    this.logger.log(`Triggering deployment/revalidation for ${domain}`);
    
    if (!this.apiToken) return { status: 'mocked', url: `https://${domain}` };

    // In a multi-tenant setup with a single project, we typically don't trigger a full deployment.
    // We just ensure the domain exists. The actual "deployment" might just be a no-op or returning the current prod deployment.
    return { status: 'READY', url: `https://${domain}` };
  }

  async createProjectFromGithub(projectName: string, githubRepoOwner: string, githubRepoName: string): Promise<any> {
    this.logger.log(`Creating Vercel Project ${projectName} linked to GitHub repo ${githubRepoOwner}/${githubRepoName}`);
    
    if (!this.apiToken) return { status: 'mocked', id: 'mock-vercel-id' };

    const url = new URL(`${this.baseUrl}/v9/projects`);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: projectName,
        framework: 'nextjs',
        repository: {
          type: 'github',
          repo: `${githubRepoOwner}/${githubRepoName}`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.code === 'project_already_exists') {
         this.logger.log(`Vercel project ${projectName} already exists`);
         return { status: 'exists' };
      }
      this.logger.warn(`Vercel API linking failed: ${error.error?.message || response.statusText}. Proceeding without auto-Vercel link.`);
      return { status: 'mocked', id: 'mock-vercel-id' };
    }

    return response.json();
  }

  async getProjectDeployments(vercelProjectId: string): Promise<any> {
    this.logger.log(`Fetching Vercel deployments for project ${vercelProjectId}`);
    
    if (!this.apiToken) return { deployments: [] };

    const url = new URL(`${this.baseUrl}/v6/deployments`);
    url.searchParams.append('projectId', vercelProjectId);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HttpException(`Vercel get deployments failed: ${error.message || response.statusText}`, response.status);
    }

    return response.json();
  }

  async getDeploymentStatus(deploymentId: string): Promise<any> {
    this.logger.log(`Fetching Vercel deployment status for ${deploymentId}`);
    
    if (!this.apiToken) return { readyState: 'READY' };

    const url = new URL(`${this.baseUrl}/v13/deployments/${deploymentId}`);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HttpException(`Vercel get deployment failed: ${error.message || response.statusText}`, response.status);
    }

    return response.json();
  }

  async revalidate(path: string, domain: string): Promise<any> {
    this.logger.log(`Revalidating path ${path} for domain ${domain}`);
    
    if (!this.apiToken) return { revalidated: true };

    // Using Next.js On-Demand ISR usually hits an API route on the *deployed Next.js app* directly,
    // NOT the Vercel API. E.g. https://domain.com/api/revalidate?path=/&secret=xyz
    // But for this client, we'll expose the interface. We need the frontend URL to hit.
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || `https://${domain}`;
    
    try {
      const response = await fetch(`${frontendUrl}/api/revalidate?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        // Pass a secret header if your Next.js app requires one
        headers: { 'x-revalidate-secret': this.configService.get<string>('JWT_SECRET') || '' },
      });
      return response.json();
    } catch (e) {
      this.logger.error(`Failed to hit revalidate API on frontend: ${e.message}`);
      throw new HttpException('Revalidation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async checkDomainPrice(name: string): Promise<any> {
    this.logger.log(`Checking price and availability for domain ${name}`);
    
    if (!this.apiToken) return { available: true, price: 10, period: 1 }; // Mock

    const url = new URL(`${this.baseUrl}/v4/domains/price`);
    url.searchParams.append('name', name);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HttpException(`Vercel domain check failed: ${error.message || response.statusText}`, response.status);
    }

    return response.json();
  }

  async buyDomain(name: string, expectedPrice: number): Promise<any> {
    this.logger.log(`Initiating domain purchase for ${name}`);

    // SAFETY GUARDRAIL: Prevent accidental real-world charges in development
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    if (!isProd || !this.apiToken) {
      this.logger.warn(`[MOCK] Bypassing real domain purchase for ${name} because we are not in production.`);
      return { 
        successful: true, 
        mocked: true, 
        domain: name, 
        message: 'Mock purchase successful.' 
      };
    }

    const url = new URL(`${this.baseUrl}/v4/domains/buy`);
    this.appendTeamId(url);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, expectedPrice }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new HttpException(`Vercel domain purchase failed: ${error.message || response.statusText}`, response.status);
    }

    return response.json();
  }
}
