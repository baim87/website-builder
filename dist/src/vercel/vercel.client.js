"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VercelClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VercelClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let VercelClient = VercelClient_1 = class VercelClient {
    configService;
    logger = new common_1.Logger(VercelClient_1.name);
    apiToken;
    teamId;
    projectId;
    baseUrl = 'https://api.vercel.com';
    constructor(configService) {
        this.configService = configService;
        this.apiToken = this.configService.get('VERCEL_API_TOKEN');
        this.teamId = this.configService.get('VERCEL_TEAM_ID');
        this.projectId = this.configService.get('VERCEL_PROJECT_ID');
        if (!this.apiToken || !this.projectId) {
            this.logger.warn('Vercel API token or Project ID is missing. Vercel client operations will fail.');
        }
    }
    getHeaders() {
        return {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
        };
    }
    appendTeamId(url) {
        if (this.teamId) {
            url.searchParams.append('teamId', this.teamId);
        }
        return url;
    }
    async addDomain(domain) {
        this.logger.log(`Adding domain ${domain} to Vercel project ${this.projectId}`);
        if (!this.apiToken)
            return { status: 'mocked', domain };
        const url = new URL(`${this.baseUrl}/v10/projects/${this.projectId}/domains`);
        this.appendTeamId(url);
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ name: domain }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new common_1.HttpException(`Vercel add domain failed: ${error.message || response.statusText}`, response.status);
        }
        return response.json();
    }
    async createDeployment(domain) {
        this.logger.log(`Triggering deployment/revalidation for ${domain}`);
        if (!this.apiToken)
            return { status: 'mocked', url: `https://${domain}` };
        return { status: 'READY', url: `https://${domain}` };
    }
    async getDeploymentStatus(deploymentId) {
        this.logger.log(`Fetching Vercel deployment status for ${deploymentId}`);
        if (!this.apiToken)
            return { readyState: 'READY' };
        const url = new URL(`${this.baseUrl}/v13/deployments/${deploymentId}`);
        this.appendTeamId(url);
        const response = await fetch(url.toString(), {
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new common_1.HttpException(`Vercel get deployment failed: ${error.message || response.statusText}`, response.status);
        }
        return response.json();
    }
    async revalidate(path, domain) {
        this.logger.log(`Revalidating path ${path} for domain ${domain}`);
        if (!this.apiToken)
            return { revalidated: true };
        const frontendUrl = this.configService.get('FRONTEND_URL') || `https://${domain}`;
        try {
            const response = await fetch(`${frontendUrl}/api/revalidate?path=${encodeURIComponent(path)}`, {
                method: 'POST',
                headers: { 'x-revalidate-secret': this.configService.get('JWT_SECRET') || '' },
            });
            return response.json();
        }
        catch (e) {
            this.logger.error(`Failed to hit revalidate API on frontend: ${e.message}`);
            throw new common_1.HttpException('Revalidation failed', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async checkDomainPrice(name) {
        this.logger.log(`Checking price and availability for domain ${name}`);
        if (!this.apiToken)
            return { available: true, price: 10, period: 1 };
        const url = new URL(`${this.baseUrl}/v4/domains/price`);
        url.searchParams.append('name', name);
        this.appendTeamId(url);
        const response = await fetch(url.toString(), {
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new common_1.HttpException(`Vercel domain check failed: ${error.message || response.statusText}`, response.status);
        }
        return response.json();
    }
    async buyDomain(name, expectedPrice) {
        this.logger.log(`Initiating domain purchase for ${name}`);
        const isProd = this.configService.get('NODE_ENV') === 'production';
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
            throw new common_1.HttpException(`Vercel domain purchase failed: ${error.message || response.statusText}`, response.status);
        }
        return response.json();
    }
};
exports.VercelClient = VercelClient;
exports.VercelClient = VercelClient = VercelClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], VercelClient);
//# sourceMappingURL=vercel.client.js.map