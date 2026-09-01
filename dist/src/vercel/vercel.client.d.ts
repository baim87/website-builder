import { ConfigService } from '@nestjs/config';
export declare class VercelClient {
    private readonly configService;
    private readonly logger;
    private readonly apiToken;
    private readonly teamId;
    private readonly projectId;
    private readonly baseUrl;
    constructor(configService: ConfigService);
    private getHeaders;
    private appendTeamId;
    addDomain(domain: string): Promise<any>;
    createDeployment(domain: string): Promise<any>;
    getDeploymentStatus(deploymentId: string): Promise<any>;
    revalidate(path: string, domain: string): Promise<any>;
    checkDomainPrice(name: string): Promise<any>;
    buyDomain(name: string, expectedPrice: number): Promise<any>;
}
